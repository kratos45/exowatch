from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from neo4j import GraphDatabase
import os
import math
from src.sim3d import generate_asteroid_3d
from openai import OpenAI

app = FastAPI(title="ExoWatch API")

# Allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the root directory statically to access generated GIFs
app.mount("/static", StaticFiles(directory="."), name="static")

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "exowatch2024")

def run_query(query, parameters=None):
    driver = GraphDatabase.driver(URI, auth=AUTH)
    with driver.session() as session:
        result = session.run(query, parameters)
        return [record.data() for record in result]

@app.get("/")
def read_root():
    return {"status": "ExoWatch API is running"}

@app.get("/api/asteroids")
def get_asteroids():
    records = run_query("""
    MATCH (n:NEO) 
    OPTIONAL MATCH (n)-[r:THREATENS]->(e:Planet) 
    RETURN n.name AS name, COALESCE(r.probability, 0) AS impact_prob, n.material AS material, n.risk_analysis AS risk, COALESCE(n.estimated_diameter_max, n.exact_diameter_m / 1000.0, 'N/A') AS d_max, COALESCE(n.relative_velocity_kmh, 'N/A') AS vel 
    ORDER BY n.name ASC LIMIT 100
    """)
    return records

@app.get("/api/mining")
def get_mining_opportunities():
    records = run_query("""
    MATCH (Earth:Planet {name: 'Earth'})-[route:REACHABLE_WITH_DELTAV]->(n:NEO)
    WHERE n.material IS NOT NULL
    RETURN n.name AS name, n.material AS material, COALESCE(n.estimated_diameter_max, n.exact_diameter_m / 1000.0, 0.5) AS diameter, COALESCE(n.relative_velocity_kmh, 50000) AS velocity, n.exploitable AS exploitable, route.cost AS delta_v_cost, route.duration_days AS duration_days
    ORDER BY route.cost ASC
    LIMIT 50
    """)
    def get_mat_value(mat):
        mat = str(mat).lower()
        if 'fer' in mat or 'nickel' in mat or 'métal' in mat: return 100
        if 'silicate' in mat: return 50
        if 'glace' in mat: return 30
        return 10
    
    for r in records:
        val = get_mat_value(r['material'])
        # New score integrating delta_V cost
        r['score'] = (val * r['diameter']) / ((r['delta_v_cost'] / 1000) + 1)
    
    records.sort(key=lambda x: x['score'], reverse=True)
    return records[:50]

@app.get("/api/impacts")
def get_impacts():
    records = run_query("""
    MATCH (n:NEO)-[r:THREATENS]->(p:Planet)
    RETURN n.name AS name, r.probability AS prob, COALESCE(n.estimated_diameter_max, n.exact_diameter_m / 1000.0, 0.5) AS diameter, COALESCE(n.relative_velocity_kmh, 50000) AS velocity, n.threat_centrality AS threat_centrality
    ORDER BY n.threat_centrality DESC LIMIT 50
    """)
    for r in records:
        r_meters = (r['diameter'] * 1000) / 2
        volume = (4/3) * math.pi * (r_meters**3)
        mass = volume * 3000 # kg
        v_ms = r['velocity'] * 1000 / 3600 # m/s
        joules = 0.5 * mass * (v_ms**2)
        r['megatons'] = round(joules / 4.184e15, 2)
    return records

@app.get("/api/graph")
def get_graph():
    records = run_query("""
    MATCH (n)-[r]->(m)
    RETURN labels(n)[0] AS source_label, n.name AS source_name, n.id AS source_id, n.cluster AS source_cluster,
           type(r) AS relation, r.probability AS prob, r.cost AS cost,
           labels(m)[0] AS target_label, m.name AS target_name, m.id AS target_id, m.cluster AS target_cluster
    LIMIT 500
    """)
    nodes = []
    links = []
    added_nodes = set()
    
    for r in records:
        src_id = r['source_name'] or r['source_id'] or "Unknown"
        tgt_id = r['target_name'] or r['target_id'] or "Unknown"
        
        if src_id not in added_nodes:
            nodes.append({"id": src_id, "label": r['source_label'], "name": src_id})
            added_nodes.add(src_id)
        if tgt_id not in added_nodes:
            nodes.append({"id": tgt_id, "label": r['target_label'], "name": tgt_id})
            added_nodes.add(tgt_id)
            
        links.append({
            "source": src_id,
            "target": tgt_id,
            "relation": r['relation'],
            "probability": r['prob']
        })
        
    return {"nodes": nodes, "links": links}

@app.get("/api/exoplanets")
def get_exoplanets():
    records = run_query("MATCH (e:Exoplanet)-[:ORBITS]->(s:Star) RETURN e.name AS name, s.name AS hostname, e.pl_rade AS pl_rade, e.pl_bmasse AS pl_bmasse, e.pl_orbper AS pl_orbper, e.anomaly_score_heuristic AS anomaly_score_heuristic, e.anomaly_score_ml AS anomaly_score_ml LIMIT 500")
    return records

class ChatRequest(BaseModel):
    question: str

@app.post("/api/chat")
def chat_to_cypher(req: ChatRequest):
    from dotenv import load_dotenv
    load_dotenv()
    client = OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
    )
    prompt = f"""
    Tu es un expert Neo4j. Le schéma est :
    (n:NEO {{name, estimated_diameter_max, relative_velocity_kmh, material, porosity, exploitable, risk_analysis}})
    (p:Planet {{name}})
    (n)-[:THREATENS {{probability}}]->(p)
    Traduisez la question suivante en UNE SEULE requête Cypher valide (sans markdown).
    Question : {req.question}
    """
    res = client.chat.completions.create(
        model="nex-agi/nex-n2.5-mini:free",
        messages=[{"role": "user", "content": prompt}]
    )
    cypher_query = res.choices[0].message.content.strip().replace("```cypher", "").replace("```", "").strip()
    
    try:
        data = run_query(cypher_query)
        summary = ""
        if not data:
            summary = "Aucune donnée spatiale correspondante n'a été trouvée dans les archives."
        else:
            summary_prompt = f"Tu es l'IA ExoWatch. Réponds à l'utilisateur : '{req.question}' de manière naturelle, concise et professionnelle (style NASA) en utilisant EXCLUSIVEMENT ces données : {str(data[:10])}. N'inclus pas de salutations."
            res_summary = client.chat.completions.create(
                model="nex-agi/nex-n2.5-mini:free",
                messages=[{"role": "user", "content": summary_prompt}]
            )
            summary = res_summary.choices[0].message.content.strip()
            
        return {"query": cypher_query, "data": data, "summary": summary}
    except Exception as e:
        return {"error": str(e), "query": cypher_query}

from src.sim3d import generate_asteroid_3d, generate_velocity_simulation

class Generate3DRequest(BaseModel):
    name: str
    material: str

@app.post("/api/generate-3d")
def api_generate_3d(req: Generate3DRequest):
    safe_name = req.name.replace(' ', '_').replace('/', '_').replace(':', '')
    gif_path = f"{safe_name}_3d.gif"
    try:
        generate_asteroid_3d(req.material, gif_path)
        return {"status": "success", "gif_path": gif_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SimulateVelocityRequest(BaseModel):
    name: str
    velocity: float

@app.post("/api/simulate-velocity")
def api_simulate_velocity(req: SimulateVelocityRequest):
    safe_name = req.name.replace(' ', '_').replace('/', '_').replace(':', '')
    gif_path = f"{safe_name}_sim.gif"
    try:
        generate_velocity_simulation(req.velocity, gif_path)
        return {"status": "success", "gif_path": gif_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
