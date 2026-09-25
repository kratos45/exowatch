"""
Page 3: Traçabilité & Lignage des Données
Vérification de bout en bout de la chaîne de transformation et de l'audit IA.
"""

import streamlit as st
import pandas as pd
import json
from src.db import get_connection

st.set_page_config(page_title="Traçabilité - ExoWatch", page_icon="🔍", layout="wide")

st.title("🔍 Traçabilité & Lignage de Bout en Bout")
st.caption("Suivi granulaire des données : du fichier brut JSON aux enrichissements d'IA générative.")

# Visual lineage flow using Mermaid diagram
st.subheader("🌐 Diagramme du Flux de Traçabilité")
st.markdown("""
```mermaid
graph LR
    A[API NASA Raw JSON<br/>data/raw/] --> B[Validation Contrat<br/>config/data_contract.yaml]
    B -->|Échec| C[Zone de Rejet<br/>table rejected_rows]
    B -->|Succès + Déduplication| D[Base Curated<br/>table neo_observations]
    D --> E[Inférence LLM<br/>table ai_enrichments]
    D --> F[Vues Métier<br/>view_hazardous / view_minable]
    E --> F
    style A fill:#1e293b,stroke:#00D4FF,stroke-width:2px,color:#fff
    style C fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fff
    style D fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff
    style E fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#fff
```
""", unsafe_allow_html=True)

st.markdown("---")

# Search by entity_id
st.subheader("🔎 Recherche par Identifiant Astéroïde (`entity_id`)")

with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT entity_id, name FROM neo_observations ORDER BY name ASC;")
    known_neos = [dict(r) for r in cursor.fetchall()]

neo_options = {f"{r['name']} ({r['entity_id']})": r['entity_id'] for r in known_neos}

selected_label = st.selectbox(
    "Choisir ou saisir un astéroïde :",
    options=["-- Entrer un identifiant libre --"] + list(neo_options.keys())
)

if selected_label == "-- Entrer un identifiant libre --":
    search_id = st.text_input("Identifiant NeoWS (ex: 2000433) :", value="").strip()
else:
    search_id = neo_options[selected_label]

if search_id:
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. Check curated observations
        cursor.execute("SELECT * FROM neo_observations WHERE entity_id = ? ORDER BY observed_at DESC;", (search_id,))
        obs_records = [dict(r) for r in cursor.fetchall()]

        # 2. Check rejected rows
        cursor.execute("SELECT * FROM rejected_rows WHERE entity_id = ? ORDER BY rejected_at DESC;", (search_id,))
        rej_records = [dict(r) for r in cursor.fetchall()]

        # 3. Check AI enrichments
        cursor.execute("SELECT * FROM ai_enrichments WHERE entity_id = ? ORDER BY enriched_at DESC;", (search_id,))
        enrich_records = [dict(r) for r in cursor.fetchall()]

        # 4. Check Sentry scores
        cursor.execute("SELECT * FROM sentry_scores WHERE entity_id = ?;", (search_id,))
        sentry_records = [dict(r) for r in cursor.fetchall()]

    col_l, col_r = st.columns(2)

    with col_l:
        st.markdown("### 📥 1. Statut dans la Base Curated")
        if obs_records:
            st.success(f"Enregistrement trouvé : {len(obs_records)} observation(s)")
            for obs in obs_records:
                st.json(obs)
        else:
            st.warning("Aucune observation validée trouvée pour cet identifiant.")

        st.markdown("### 🚫 2. Enregistrements Rejetés")
        if rej_records:
            st.error(f"{len(rej_records)} rejet(s) documenté(s) pour cet identifiant")
            for rej in rej_records:
                st.error(f"Motif du rejet : **{rej['rejection_reason']}**")
                st.caption(f"Horodatage : {rej['rejected_at']} | Run ID : `{rej['run_id']}`")
                with st.expander("Payload brut rejeté"):
                    try:
                        st.json(json.loads(rej["raw_payload"]))
                    except:
                        st.code(rej["raw_payload"])
        else:
            st.info("Aucun rejet enregistré pour cet identifiant.")

    with col_r:
        st.markdown("### 🤖 3. Enrichissements d'IA Générative")
        if enrich_records:
            st.success(f"{len(enrich_records)} champ(s) enrichi(s) par IA")
            for enrich in enrich_records:
                with st.container(border=True):
                    st.markdown(f"**Champ :** `{enrich['field_enriched']}`")
                    st.markdown(f"**Valeur Inféree :** `{enrich['value']}`")
                    st.markdown(f"**Indice de Confiance :** `{enrich['confidence']:.2f}`")
                    st.markdown(f"**Modèle Utilisé :** `{enrich['model_used']}`")
                    st.markdown(f"**Version du Prompt :** `{enrich['prompt_version']}`")
                    st.markdown(f"**Run ID associé :** `{enrich['pipeline_run_id']}`")
                    st.caption(f"Enrichi le {enrich['enriched_at']}")
        else:
            st.info("Cet astéroïde n'a pas encore fait l'objet d'un enrichissement LLM.")

        if sentry_records:
            st.markdown("### 🎯 4. Données Sentry (Risque d'Impact)")
            st.json(sentry_records)
