import os
import json
from neo4j import GraphDatabase
from openai import OpenAI

OPENROUTER_API_KEY = "REMOVED_API_KEY"

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
)

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "exowatch2024")

def augment_asteroids(batch_size=50):
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    with driver.session() as session:
        total_augmented = 0
        while True:
            # On récupère les NEOs qui n'ont pas encore été enrichis
            records = session.run(f"MATCH (n:NEO) WHERE n.material IS NULL RETURN n.id AS id, n.name AS name, n.estimated_diameter_max AS d_max LIMIT {batch_size}").data()
            
            if not records:
                print(f"Terminé ! {total_augmented} astéroïdes ont été enrichis au total.")
                break
                
            print(f"Enrichissement par IA (OpenRouter - Gratuit) d'un lot de {len(records)} astéroïdes...")
            
            # Demander au LLM de générer des données structurées pour le lot
            prompt = f"""
            Tu es un astrophysicien et géologue spatial expert. 
            Pour la liste d'astéroïdes géocroiseurs (NEOs) fournie, tu dois inférer ou générer des données plausibles (data augmentation) basées sur la taxonomie astéroïdale générale.
            
            Retourne UNIQUEMENT un tableau JSON plat, sans aucun texte avant ou après. Pas de balises markdown ```json, juste le tableau brut. 
            Chaque objet doit avoir :
            - "id": string (strictement l'ID fourni)
            - "material": string (ex: "Chondrite carbonée", "Silicates", "Fer-Nickel métallique", "Glace et poussières")
            - "porosity": float (entre 0.0 et 1.0)
            - "exploitable": boolean (potentiel minier rentable ?)
            - "risk_analysis": string (courte analyse qualitative, ex: "Risque faible, orbite stable" ou "Forte teneur en métaux lourds")
            - "exact_diameter_m": integer (diamètre estimé précis, inspire toi du d_max si fourni)
            
            Données d'entrée (JSON) :
            {json.dumps(records)}
            """
            
            try:
                response = client.chat.completions.create(
                    model="nex-agi/nex-n2.5-mini:free",
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                
                response_text = response.choices[0].message.content.strip()
                
                # Nettoyage au cas où le modèle renvoie quand même du markdown
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                    
                results = json.loads(response_text)
                
                # Mise à jour des nœuds dans Neo4j
                count = 0
                for res in results:
                    # Filtrer les clés pour éviter les erreurs si l'IA hallucine une clé
                    session.run('''
                        MATCH (n:NEO {id: $id})
                        SET n.material = $material,
                            n.porosity = $porosity,
                            n.exploitable = $exploitable,
                            n.risk_analysis = $risk_analysis,
                            n.exact_diameter_m = $exact_diameter_m
                    ''', {
                        "id": res.get("id"),
                        "material": res.get("material", "Inconnu"),
                        "porosity": float(res.get("porosity", 0.0)),
                        "exploitable": bool(res.get("exploitable", False)),
                        "risk_analysis": str(res.get("risk_analysis", "")),
                        "exact_diameter_m": int(res.get("exact_diameter_m", 0))
                    })
                    count += 1
                total_augmented += count
                print(f"-> {count} astéroïdes augmentés avec succès ! (Total: {total_augmented})")
            except Exception as e:
                print("Erreur lors de la génération/parsing :", e)
                try:
                    print("Texte retourné :", response_text)
                except:
                    pass
                print("Passage au lot suivant ignoré ou erreur critique, arrêt.")
                break

if __name__ == "__main__":
    print("Démarrage de l'enrichissement continu...")
    augment_asteroids(50)
