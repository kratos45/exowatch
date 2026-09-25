import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import os
from dotenv import load_dotenv
from neo4j import GraphDatabase
from pyvis.network import Network
import tempfile

load_dotenv()
st.set_page_config(page_title="ExoWatch Neo4j", page_icon="🪐", layout="wide")

# Neo4j connection
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "exowatch2024")

@st.cache_resource
def get_driver():
    return GraphDatabase.driver(URI, auth=AUTH)

def run_query(query, parameters=None):
    driver = get_driver()
    with driver.session() as session:
        result = session.run(query, parameters)
        return [record.data() for record in result]

st.title("🪐 ExoWatch : Explorateur de Graphe (Neo4j)")

st.sidebar.header("Options de Vue")
view_mode = st.sidebar.radio("Vue :", [
    "Graphe Interstellaire (PyVis)", 
    "Explorateur Exoplanètes", 
    "Explorateur Astéroïdes", 
    "Fiche Astéroïde 3D",
    "🤖 Assistant Text-to-Cypher",
    "💰 Minage Spatial",
    "💥 Radar & Impacts"
])

st.sidebar.markdown("---")
st.sidebar.header("Analyse de Danger")
st.sidebar.caption("Sélectionnez un objet pour consulter son profil de risque détaillé.")

# Fetch a list of all asteroids for the dropdown
asteroids_records = run_query("MATCH (n:NEO) OPTIONAL MATCH (n)-[r:THREATENS]->(e:Planet) RETURN n.name AS name, r.probability AS impact_prob, n.material AS material, n.risk_analysis AS risk, n.estimated_diameter_max AS d_max, n.relative_velocity_kmh AS vel ORDER BY n.name ASC LIMIT 100")
if asteroids_records:
    asteroid_names_sb = [r["name"] for r in asteroids_records]
    selected_ast_sb = st.sidebar.selectbox("Sélectionnez un astéroïde :", asteroid_names_sb, key="sb_ast_select")
    selected_ast_data = next(r for r in asteroids_records if r["name"] == selected_ast_sb)
    
    st.sidebar.write(f"**Nom:** {selected_ast_data['name']}")
    st.sidebar.write(f"**Matériau:** {selected_ast_data['material'] or 'Inconnu'}")
    
    # Description générée
    d_max = selected_ast_data.get('d_max')
    vel = selected_ast_data.get('vel')
    desc_parts = []
    if d_max:
        desc_parts.append(f"un diamètre estimé à {d_max} km")
    if vel:
        desc_parts.append(f"une vitesse relative de {vel} km/h")
    
    if desc_parts:
        st.sidebar.info(f"**Données physiques:** Cet objet spatial possède {' et '.join(desc_parts)}.")
    
    if st.sidebar.button("Générer une description détaillée (IA)"):
        with st.sidebar.spinner("Génération en cours..."):
            try:
                from openai import OpenAI
                # On réutilise la clé d'OpenRouter de augment_llm
                import os
                from dotenv import load_dotenv
                load_dotenv()
                client = OpenAI(
                    api_key=os.getenv("OPENROUTER_API_KEY"),
                    base_url="https://openrouter.ai/api/v1",
                )
                prompt = f"""
                Agis comme un astronome de la NASA présentant un briefing. Fais un court paragraphe (3-4 phrases max) passionnant et réaliste pour décrire l'astéroïde suivant:
                Nom: {selected_ast_data['name']}
                Matière probable: {selected_ast_data['material']}
                Diamètre: {selected_ast_data.get('d_max')} km
                Vitesse: {selected_ast_data.get('vel')} km/h
                Probabilité d'impact avec la Terre: {selected_ast_data['impact_prob']}%
                """
                
                response = client.chat.completions.create(
                    model="nex-agi/nex-n2.5-mini:free",
                    messages=[{"role": "user", "content": prompt}]
                )
                
                ai_desc = response.choices[0].message.content.strip()
                st.sidebar.success(ai_desc)
            except Exception as e:
                st.sidebar.error(f"Erreur lors de la génération IA : {e}")

    prob = selected_ast_data['impact_prob'] or 0.0
    
    if prob >= 5.0:
        color = "#ff4b4b" # red
        danger_text = "DANGER CRITIQUE"
    elif prob > 0.0:
        color = "#ffa500" # orange
        danger_text = "ATTENTION"
    else:
        color = "#00cc66" # green
        danger_text = "SÛR"
        
    st.sidebar.markdown(f"**Niveau de Danger:** <span style='color:{color}; font-weight:bold;'>{danger_text} ({prob}%)</span>", unsafe_allow_html=True)
    if selected_ast_data['risk']:
        st.sidebar.write(f"**Analyse IA (Base de données):** {selected_ast_data['risk']}")

def render_subgraph(records, height="600px"):
    net = Network(height=height, width='100%', bgcolor='#222222', font_color='white', directed=True)
    net.repulsion(node_distance=150, central_gravity=0.2, spring_length=200)

    added_nodes = set()
    for record in records:
        src_id = record.get('source_name') or record.get('source_id') or "Unknown"
        tgt_id = record.get('target_name') or record.get('target_id') or "Unknown"
        
        src_label = record.get('source_label', 'Unknown')
        tgt_label = record.get('target_label', 'Unknown')
        
        src_color = "#FFD700" if src_label == "Star" else ("#00FFFF" if src_label == "Exoplanet" else "#FF4500")
        tgt_color = "#FFD700" if tgt_label == "Star" else ("#00FFFF" if tgt_label == "Exoplanet" else "#4169E1")
        
        if src_id not in added_nodes:
            net.add_node(src_id, label=src_id, title=src_label, color=src_color)
            added_nodes.add(src_id)
        if tgt_id not in added_nodes:
            net.add_node(tgt_id, label=tgt_id, title=tgt_label, color=tgt_color)
            added_nodes.add(tgt_id)
            
        edge_label = record.get('relation', 'RELATES_TO')
        if record.get('prob') is not None:
            edge_label += f" ({record['prob']}%)"
        
        color = "red" if record.get('relation') == "THREATENS" else "white"
        net.add_edge(src_id, tgt_id, title=edge_label, color=color)
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as f:
        net.save_graph(f.name)
        html_content = open(f.name, 'r', encoding='utf-8').read()
        
    components.html(html_content, height=int(height.replace("px", "")) + 20)

if view_mode == "Graphe Interstellaire (PyVis)":
    st.write("Ce graphe représente les relations physiques réelles dans l'univers connu : Les exoplanètes orbitent autour d'étoiles, les NEOs orbitent autour du Soleil, et certains NEOs menacent la Terre.")
    
    with st.spinner("Génération du Graphe Physique..."):
        query = """
        MATCH (n)-[r]->(m)
        RETURN labels(n)[0] AS source_label, n.name AS source_name, n.id AS source_id,
               type(r) AS relation, r.probability AS prob,
               labels(m)[0] AS target_label, m.name AS target_name, m.id AS target_id
        LIMIT 500
        """
        records = run_query(query)
        render_subgraph(records, height="600px")

elif view_mode == "Explorateur Exoplanètes":
    st.subheader("Planètes extrasolaires (Neo4j)")
    records = run_query("MATCH (e:Exoplanet)-[:ORBITS]->(s:Star) RETURN e.name AS name, s.name AS hostname, e.pl_rade AS pl_rade, e.pl_bmasse AS pl_bmasse, e.pl_orbper AS pl_orbper, e.anomaly_score_heuristic AS anomaly_score_heuristic, e.anomaly_score_ml AS anomaly_score_ml LIMIT 500")
    if not records:
        st.warning("Aucune donnée d'exoplanète trouvée.")
    else:
        df = pd.DataFrame(records)
        st.dataframe(df)
        
        st.write("### Graphe des relations stellaires")
        query_graph = """
        MATCH (n:Exoplanet)-[r:ORBITS]->(m:Star)
        RETURN labels(n)[0] AS source_label, n.name AS source_name, n.id AS source_id,
               type(r) AS relation, null AS prob,
               labels(m)[0] AS target_label, m.name AS target_name, m.id AS target_id
        LIMIT 200
        """
        graph_records = run_query(query_graph)
        render_subgraph(graph_records, height="400px")

elif view_mode == "Explorateur Astéroïdes":
    st.subheader("Astéroïdes Géocroiseurs et Risques d'Impact (Neo4j)")
    records = run_query("MATCH (n:NEO) OPTIONAL MATCH (n)-[r:THREATENS]->(e:Planet) RETURN n.name AS name, n.estimated_diameter_max AS d_max, n.relative_velocity_kmh AS vel, r.probability AS impact_prob, n.material AS material, n.porosity AS porosity, n.exploitable AS exploitable, n.risk_analysis AS risk_analysis ORDER BY r.probability DESC LIMIT 500")
    if not records:
        st.warning("Aucune donnée d'astéroïde trouvée.")
    else:
        df = pd.DataFrame(records)
        df.fillna({
            "material": "Non analysé",
            "porosity": 0.0,
            "exploitable": False,
            "risk_analysis": "En attente d'analyse IA",
            "impact_prob": 0.0
        }, inplace=True)
        st.dataframe(df)
        
        st.write("### Graphe des menaces (Astéroïdes menaçant la Terre)")
        query_graph = """
        MATCH (n:NEO)-[r:THREATENS]->(m:Planet)
        RETURN labels(n)[0] AS source_label, n.name AS source_name, n.id AS source_id,
               type(r) AS relation, r.probability AS prob,
               labels(m)[0] AS target_label, m.name AS target_name, m.id AS target_id
        LIMIT 200
        """
        graph_records = run_query(query_graph)
        render_subgraph(graph_records, height="400px")

elif view_mode == "Fiche Astéroïde 3D":
    st.subheader("Générateur 3D d'Astéroïde (Shap-E)")
    records = run_query("MATCH (n:NEO) RETURN n.name AS name, n.material AS material, n.porosity AS porosity, n.estimated_diameter_max AS d_max ORDER BY n.name ASC LIMIT 100")
    if not records:
        st.warning("Aucun astéroïde trouvé.")
    else:
        asteroid_names = [r["name"] for r in records]
        selected_name = st.selectbox("Sélectionnez un astéroïde :", asteroid_names)
        selected_data = next(r for r in records if r["name"] == selected_name)
        col1, col2 = st.columns([1, 1])
        with col1:
            st.write("### Métadonnées")
            st.write(f"- **Nom** : {selected_data['name']}")
            st.write(f"- **Matière** : {selected_data['material'] or 'Inconnu'}")
            st.write(f"- **Diamètre estimé** : {selected_data['d_max']} km")
            st.write(f"- **Porosité** : {selected_data['porosity']}")
        with col2:
            import os
            gif_path = f"{selected_name.replace(' ', '_')}_3d.gif"
            
            # Afficher l'image si elle existe déjà
            if os.path.exists(gif_path):
                st.image(gif_path, caption=f"Vue 3D de {selected_name}")
            
            if st.button("Générer / Régénérer la vue 3D"):
                import sys; sys.path.append(os.path.dirname(__file__))
                try:
                    from src.sim3d import generate_asteroid_3d
                except ImportError:
                    st.error("Module sim3d introuvable.")
                else:
                    with st.spinner("Création du modèle 3D par l'IA... (Ceci peut prendre jusqu'à 15 minutes sur CPU)"):
                        mat = selected_data['material'] or "rock"
                        try:
                            generate_asteroid_3d(mat, gif_path)
                            st.rerun() # Recharge la page pour afficher l'image
                        except Exception as e:
                            st.error(f"Erreur lors de la génération 3D : {e}")

elif view_mode == "🤖 Assistant Text-to-Cypher":
    st.subheader("🤖 Assistant IA : Posez vos questions en langage naturel")
    st.write("Cet assistant traduit votre question en langage Cypher, interroge la base Neo4j et vous donne la réponse.")
    
    question = st.text_input("Votre question (ex: Trouve moi les 5 astéroïdes les plus dangereux composés de fer) :")
    if st.button("Demander à l'IA") and question:
        with st.spinner("Analyse et génération de la requête Cypher..."):
            try:
                from openai import OpenAI
                import os
                from dotenv import load_dotenv
                load_dotenv()
                client = OpenAI(
                    api_key=os.getenv("OPENROUTER_API_KEY"),
                    base_url="https://openrouter.ai/api/v1",
                )
                
                # 1. Text to Cypher
                prompt_cypher = f"""
                Tu es un expert Neo4j. Le schéma est :
                (n:NEO {{name, estimated_diameter_max, relative_velocity_kmh, material, porosity, exploitable, risk_analysis}})
                (p:Planet {{name}})
                (n)-[:THREATENS {{probability}}]->(p)
                Traduisez la question suivante en UNE SEULE requête Cypher valide (sans markdown, sans explications).
                Question : {question}
                """
                res = client.chat.completions.create(
                    model="nex-agi/nex-n2.5-mini:free",
                    messages=[{"role": "user", "content": prompt_cypher}]
                )
                cypher_query = res.choices[0].message.content.strip().replace("```cypher", "").replace("```", "").strip()
                st.code(cypher_query, language="cypher")
                
                # 2. Execution
                data = run_query(cypher_query)
                st.write("**Résultats de la base de données :**")
                st.dataframe(pd.DataFrame(data))
                
            except Exception as e:
                st.error(f"Erreur : {e}")

elif view_mode == "💰 Minage Spatial":
    st.subheader("💰 Opportunités de Minage Spatial (Space Mining)")
    st.write("Cette vue identifie les cibles les plus rentables basées sur la matière, la taille et la vitesse (difficulté d'accès).")
    
    records = run_query("""
    MATCH (n:NEO)
    WHERE n.material IS NOT NULL AND n.estimated_diameter_max IS NOT NULL
    RETURN n.name AS name, n.material AS material, n.estimated_diameter_max AS diameter, n.relative_velocity_kmh AS velocity, n.exploitable AS exploitable
    """)
    if records:
        df = pd.DataFrame(records)
        
        # Algorithme simple de score de minage
        def get_mat_value(mat):
            mat = str(mat).lower()
            if 'fer' in mat or 'nickel' in mat or 'métal' in mat: return 100
            if 'silicate' in mat: return 50
            if 'glace' in mat: return 30
            return 10
            
        df['Valeur_Matière'] = df['material'].apply(get_mat_value)
        # Score = (Valeur * Diamètre) / (Vitesse / 10000)
        df['Score_Rentabilité'] = (df['Valeur_Matière'] * df['diameter']) / (df['velocity'] / 10000 + 1)
        df = df.sort_values(by="Score_Rentabilité", ascending=False).head(50)
        
        st.dataframe(df.style.background_gradient(subset=['Score_Rentabilité'], cmap='Greens'))
        
        import plotly.express as px
        fig = px.scatter(df, x="velocity", y="diameter", size="Score_Rentabilité", color="material", hover_name="name", title="Cartographie de Rentabilité (Taille vs Vitesse)")
        st.plotly_chart(fig, use_container_width=True)

elif view_mode == "💥 Radar & Impacts":
    st.subheader("💥 Simulateur d'Impact (Énergie Cinétique)")
    st.write("Évaluation des dégâts potentiels en Mégatonnes (Mt) pour les astéroïdes menaçants.")
    
    records = run_query("""
    MATCH (n:NEO)-[r:THREATENS]->(p:Planet)
    WHERE n.estimated_diameter_max IS NOT NULL AND n.relative_velocity_kmh IS NOT NULL
    RETURN n.name AS name, r.probability AS prob, n.estimated_diameter_max AS diameter, n.relative_velocity_kmh AS velocity
    ORDER BY r.probability DESC LIMIT 50
    """)
    
    if records:
        df = pd.DataFrame(records)
        # Energie cinétique = 1/2 m v^2. 
        # Masse ~ Volume * densité (densité ~ 3000 kg/m3). v en m/s. 1 Mt = 4.184e15 Joules
        import math
        def calc_megatons(row):
            r_meters = (row['diameter'] * 1000) / 2
            volume = (4/3) * math.pi * (r_meters**3)
            mass = volume * 3000 # kg
            v_ms = row['velocity'] * 1000 / 3600 # m/s
            joules = 0.5 * mass * (v_ms**2)
            mt = joules / 4.184e15
            return round(mt, 2)
            
        df['Energie_Impact_Mt'] = df.apply(calc_megatons, axis=1)
        df = df.sort_values(by="Energie_Impact_Mt", ascending=False)
        
        st.dataframe(df.style.background_gradient(subset=['Energie_Impact_Mt'], cmap='Reds'))
        
        import plotly.express as px
        fig = px.bar(df.head(15), x="name", y="Energie_Impact_Mt", color="prob", title="Top 15 - Énergie d'Impact Potentielle (Mégatonnes)", labels={'prob': "Probabilité (%)"})
        st.plotly_chart(fig, use_container_width=True)