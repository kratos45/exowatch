"""
Text-to-SQL conversational agent module for ExoWatch.
Translates natural language questions into safe, sanitized, read-only SQLite queries.
Enforces strict SQL verification and logs every interaction in agent_queries.
"""

import os
import re
import sqlite3
import logging
from typing import Tuple, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
from dotenv import load_dotenv

from src.db import get_db_path, get_connection
from src.enrich import get_llm_client, DEFAULT_MODEL

load_dotenv()
logger = logging.getLogger(__name__)

ALLOWED_KEYWORDS = {"SELECT"}
FORBIDDEN_KEYWORDS = {"DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "ATTACH", "PRAGMA", "CREATE", "EXEC", "REPLACE", "TRUNCATE"}

SCHEMA_CONTEXT = """
Base de données SQLite 'neo_curated.db' :
Tables et Vues disponibles :
1. view_hazardous (entity_id, name, observed_at, diameter_km_min, diameter_km_max, velocity_kmh, miss_distance_km, absolute_magnitude, orbit_class, palermo_scale, torino_scale, impact_probability)
   - Contient uniquement les astéroïdes classés dangereux (is_hazardous = 1), triés par distance croissante.
2. view_minable (entity_id, name, diameter_km_max, velocity_kmh, miss_distance_km, orbit_class, mining_assessment, confidence, model_used, enriched_at)
   - Contient les évaluations d'exploitation minière (valeurs de mining_assessment: 'high', 'medium', 'low').
3. neo_observations (observation_id, entity_id, observed_at, name, diameter_km_min, diameter_km_max, velocity_kmh, miss_distance_km, is_hazardous, absolute_magnitude, orbit_class, source_raw_file)
4. priority_scores (id, entity_id, score, computed_at, run_id)
   - Score composite d'urgence (0-100).
5. anomaly_scores (id, entity_id, anomaly_score, is_anomaly, run_id, computed_at)
   - Scores d'anomalie Isolation Forest ML.
6. sentry_scores (id, entity_id, palermo_scale, torino_scale, impact_probability)
7. pipeline_runs (run_id, executed_at, input_rows, accepted_rows, rejected_rows, quality_status, duration_seconds)
"""


def generate_sql(question: str) -> Tuple[str, str]:
    """
    Generates a read-only SQLite SELECT query for the user's natural language question.
    Returns (sql_query, model_used).
    """
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    model_used = DEFAULT_MODEL

    system_prompt = (
        "Vous êtes un assistant expert SQL pour la base SQLite ExoWatch NEO Intelligence.\n"
        "RÈGLES ABSOLUES :\n"
        "1. Générez UNIQUEMENT une requête SQLite SELECT valide.\n"
        "2. N'écrivez aucun mot d'explication, aucun bloc markdown ```sql, AUCUN commentaire. Renvoyez uniquement la requête SQL brute sur une seule ligne.\n"
        "3. Ne générez JAMAIS d'instructions DROP, DELETE, UPDATE, INSERT, ALTER, ATTACH, PRAGMA.\n"
        "4. Utilisez les vues 'view_hazardous' ou 'view_minable' de préférence quand la question porte sur le danger ou les mines.\n"
        "5. Limitez toujours les résultats avec 'LIMIT 50' par sécurité sauf si un comptage COUNT(*) est demandé.\n"
        f"Schéma :\n{SCHEMA_CONTEXT}"
    )

    user_prompt = f"Question : {question}"

    if api_key and not api_key.startswith("your_"):
        try:
            client = get_llm_client()
            resp = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,
                max_tokens=250,
                timeout=12.0
            )
            raw_sql = resp.choices[0].message.content.strip()
            # Remove any markdown wrapping
            raw_sql = re.sub(r"^```(?:sql)?\s*", "", raw_sql, flags=re.IGNORECASE)
            raw_sql = re.sub(r"\s*```$", "", raw_sql)
            raw_sql = raw_sql.strip()
            return raw_sql, resp.model or DEFAULT_MODEL
        except Exception as e:
            logger.warning(f"Text-to-SQL generation failed ({e}). Falling back to pattern-matched heuristics.")

    # Rule-based / pattern heuristic fallback
    q_lower = question.lower()
    model_used = "pattern-matched-sql-engine"

    if "dangereux" in q_lower or "menace" in q_lower or "hazard" in q_lower:
        sql = "SELECT entity_id, name, observed_at, diameter_km_max, velocity_kmh, miss_distance_km FROM view_hazardous ORDER BY miss_distance_km ASC LIMIT 10;"
    elif "minier" in q_lower or "mine" in q_lower or "ressource" in q_lower:
        sql = "SELECT entity_id, name, diameter_km_max, velocity_kmh, mining_assessment, confidence FROM view_minable ORDER BY confidence DESC LIMIT 10;"
    elif "priorité" in q_lower or "urgent" in q_lower or "score" in q_lower:
        sql = "SELECT p.entity_id, n.name, p.score, n.miss_distance_km, n.is_hazardous FROM priority_scores p JOIN neo_observations n ON p.entity_id = n.entity_id ORDER BY p.score DESC LIMIT 10;"
    elif "anomal" in q_lower or "atypique" in q_lower:
        sql = "SELECT a.entity_id, n.name, a.anomaly_score, n.diameter_km_max, n.velocity_kmh FROM anomaly_scores a JOIN neo_observations n ON a.entity_id = n.entity_id ORDER BY a.anomaly_score ASC LIMIT 10;"
    elif "combien" in q_lower or "total" in q_lower or "nombre" in q_lower:
        sql = "SELECT COUNT(*) AS total_observations FROM neo_observations;"
    else:
        sql = "SELECT entity_id, name, observed_at, diameter_km_max, velocity_kmh, miss_distance_km, is_hazardous FROM neo_observations ORDER BY observed_at DESC LIMIT 10;"

    return sql, model_used


def validate_sql(sql: str) -> Tuple[bool, str]:
    """
    Validates that a generated SQL string is strictly a single, safe SELECT statement.
    """
    if not sql or not sql.strip():
        return False, "Requête vide"

    cleaned = sql.strip().rstrip(";")

    # Must start with SELECT
    if not re.match(r"^SELECT\b", cleaned, re.IGNORECASE):
        return False, "La requête doit impérativement débuter par SELECT"

    # Multiple statements disallowed (disallow semicolons in the body)
    if ";" in cleaned:
        return False, "Injections à requêtes multiples interdites (point-virgule détecté)"

    # Check for forbidden keywords
    tokens = re.findall(r"\b[A-Za-z_]+\b", cleaned)
    upper_tokens = {t.upper() for t in tokens}
    intersection = upper_tokens.intersection(FORBIDDEN_KEYWORDS)
    if intersection:
        return False, f"Mot-clé interdit détecté : {', '.join(intersection)}"

    return True, "Validé"


def execute_readonly(sql: str, db_path: Optional[str] = None) -> pd.DataFrame:
    """
    Executes a SQL query in strictly read-only mode via SQLite URI parameters.
    Guarantees physical impossibility of writes even if validation is bypassed.
    """
    if not db_path:
        db_path = str(get_db_path().resolve()).replace("\\", "/")

    uri_connection_string = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri_connection_string, uri=True)
    try:
        df = pd.read_sql_query(sql, conn)
        return df
    finally:
        conn.close()


def log_agent_query(
    question: str, 
    generated_sql: str, 
    was_valid: bool, 
    row_count: int, 
    model_used: str
):
    """Logs the interaction in SQLite agent_queries table for auditability."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO agent_queries (question, generated_sql, was_valid, row_count, model_used)
                VALUES (?, ?, ?, ?, ?);
            """, (question, generated_sql, int(was_valid), row_count, model_used))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to log agent query ({e})")


def synthesize_answer(question: str, df: pd.DataFrame, model_used: str = DEFAULT_MODEL) -> str:
    """
    Synthesizes tabular query results into a clear, natural French explanation.
    """
    if df.empty:
        return "Aucun enregistrement ne correspond à ces critères dans la base de surveillance actuelle."

    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")

    if api_key and not api_key.startswith("your_") and model_used != "pattern-matched-sql-engine":
        try:
            client = get_llm_client()
            system_prompt = (
                "Vous êtes l'officier de renseignement tactique ExoWatch. "
                "Répondez à la question posée par l'analyste en vous appuyant UNIQUEMENT sur les données fournies. "
                "Faites une réponse claire, synthétique et opérationnelle en français (2 à 4 phrases max). "
                "Citez les chiffres clés (noms, distances, diamètres, scores)."
            )
            data_sample = df.head(10).to_dict(orient="records")
            user_prompt = f"Question : {question}\nDonnées issues de la base ({len(df)} lignes trouvées) :\n{data_sample}"

            resp = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=250,
                timeout=12.0
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Synthesis failed ({e}). Using deterministic summary.")

    # Fallback deterministic synthesis
    total = len(df)
    cols = list(df.columns)
    first_row = df.iloc[0].to_dict()

    if "total_observations" in first_row:
        return f"La base de données recense actuellement un total de **{first_row['total_observations']}** observations validées sous contrat."

    names = df["name"].tolist() if "name" in cols else df["entity_id"].tolist() if "entity_id" in cols else []
    preview = ", ".join(str(n) for n in names[:3])
    
    return f"La requête a identifié **{total}** résultat(s). Les principales entités correspondantes sont : **{preview}**."
