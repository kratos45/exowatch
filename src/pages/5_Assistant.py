"""
Page 5: Assistant Conversationnel (Text-to-SQL)
Interrogation en langage naturel de neo_curated.db avec exécution en lecture seule garantie.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import pandas as pd

from src.ui.theme import inject_theme
from src.agent.text_to_sql import (
    generate_sql,
    validate_sql,
    execute_readonly,
    synthesize_answer,
    log_agent_query
)

st.set_page_config(
    page_title="Assistant Renseignement - ExoWatch",
    page_icon="🤖",
    layout="wide"
)

# Apply Mission Control theme
inject_theme()

st.title("🤖 ASSISTANT TACTIQUE — TEXT-TO-SQL SÉCURISÉ")
st.caption("INTERROGATION EN LANGAGE NATUREL | CONVERSION SQL SANITISÉE | CONNEXION READ-ONLY STRICTE")

# Initialize chat history in session_state
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": (
                "Bonjour Officier. Je suis votre assistant tactique ExoWatch. "
                "Posez-moi toute question sur les passages rapprochés, les niveaux de menace, "
                "les scores de priorité ou les opportunités minières spatiales."
            ),
            "sql": None,
            "df": None
        }
    ]

# Sidebar suggestions & Audit
with st.sidebar:
    st.header("⚡ Requêtes Suggérées")
    suggestions = [
        "Quels objets ont un score de priorité > 70 ?",
        "Compare les objets dangereux par distance",
        "Quels sont les astéroïdes à fort potentiel minier ?",
        "Quels sont les objets structurellement anormaux ?",
        "Combien d'observations au total ?"
    ]
    
    suggested_prompt = None
    for s in suggestions:
        if st.button(s, use_container_width=True):
            suggested_prompt = s

    st.markdown("---")
    st.markdown("**Garanties de Sécurité :**")
    st.markdown("- Requêtes `SELECT` uniquement")
    st.markdown("- Mots-clés destructeurs bannis (`DROP`, `DELETE`...)")
    st.markdown("- Connexion SQLite `mode=ro` (Read-Only)")
    st.markdown("- Audit intégral dans `agent_queries`")

# Render existing chat messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])
        if msg.get("sql"):
            with st.expander("🔍 Requête SQL générée (Lecture Seule)"):
                st.code(msg["sql"], language="sql")
        if msg.get("df") is not None and not msg["df"].empty:
            with st.expander(f"📊 Données brutes ({len(msg['df'])} lignes)"):
                st.dataframe(msg["df"], use_container_width=True)

# User input handling
user_input = st.chat_input("Ex: Quels sont les 3 astéroïdes les plus rapides ?")
active_prompt = suggested_prompt or user_input

if active_prompt:
    # Append user question
    st.session_state.messages.append({"role": "user", "content": active_prompt})
    with st.chat_message("user"):
        st.write(active_prompt)

    with st.chat_message("assistant"):
        with st.spinner("Analyse sémantique et génération SQL..."):
            raw_sql, model_used = generate_sql(active_prompt)
            is_valid, reason = validate_sql(raw_sql)

            if not is_valid:
                log_agent_query(active_prompt, raw_sql, was_valid=False, row_count=0, model_used=model_used)
                err_msg = f"⛔ **Requête rejetée par le garde-fou de sécurité :** {reason}."
                st.error(err_msg)
                with st.expander("SQL Rejeté"):
                    st.code(raw_sql, language="sql")
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": err_msg,
                    "sql": raw_sql,
                    "df": None
                })
            else:
                try:
                    # Execute read-only
                    df_results = execute_readonly(raw_sql)
                    row_count = len(df_results)
                    log_agent_query(active_prompt, raw_sql, was_valid=True, row_count=row_count, model_used=model_used)

                    # Synthesize explanation
                    answer = synthesize_answer(active_prompt, df_results, model_used=model_used)
                    st.write(answer)

                    with st.expander("🔍 Requête SQL exécutée (Lecture Seule)"):
                        st.code(raw_sql, language="sql")

                    if not df_results.empty:
                        with st.expander(f"📊 Résultats tabulaires ({row_count} lignes)"):
                            st.dataframe(df_results, use_container_width=True)

                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": answer,
                        "sql": raw_sql,
                        "df": df_results
                    })
                except Exception as e:
                    err_msg = f"Erreur lors de l'exécution SQLite : {e}"
                    st.error(err_msg)
                    log_agent_query(active_prompt, raw_sql, was_valid=False, row_count=0, model_used=model_used)
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": err_msg,
                        "sql": raw_sql,
                        "df": None
                    })
