from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "exowatch2024")

def get_driver():
    return GraphDatabase.driver(URI, auth=AUTH)

def init_db():
    driver = get_driver()
    with driver.session() as session:
        # Purge existing data
        session.run("MATCH (n) DETACH DELETE n")
        
        # Create Constraints
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Exoplanet) REQUIRE e.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (s:Star) REQUIRE s.name IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (n:NEO) REQUIRE n.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Planet) REQUIRE p.name IS UNIQUE")
        
        # Create core planetary bodies
        session.run("MERGE (s:Star {name: 'Sun'})")
        session.run("MERGE (p:Planet {name: 'Earth'})")
        
    driver.close()

if __name__ == "__main__":
    init_db()
    print("Neo4j Database Initialized.")
