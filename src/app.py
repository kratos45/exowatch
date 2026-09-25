import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv

from src.ui.theme import inject_theme
from src.ui.components import render_kpi_card, apply_plotly_theme
from src.db import init_db, get_connection
from src.pipeline import run_pipeline

load_dotenv()

# Page config
st.set_page_config(
    page_title="ExoWatch - Surveillance NEO & Qualité Données",
    page_icon="🌌",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Apply Mission Control Theme
inject_theme()

# Ensure database is initialized
init_db()


def load_kpi_data():
    """Fetches high level KPIs from curated database."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM neo_observations;")
        total_obs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM neo_observations WHERE is_hazardous = 1;")
        hazardous_obs = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT entity_id) FROM ai_enrichments;")
        enriched_count = cursor.fetchone()[0]

        cursor.execute("SELECT * FROM pipeline_runs ORDER BY executed_at DESC LIMIT 1;")
        last_run = cursor.fetchone()

        cursor.execute("SELECT * FROM view_data_quality_audit LIMIT 5;")
        audit_history = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
            SELECT entity_id, name, diameter_km_min, diameter_km_max, 
                   velocity_kmh, miss_distance_km, is_hazardous, observed_at
            FROM neo_observations;
        """)
        obs_df = pd.DataFrame([dict(row) for row in cursor.fetchall()])

    return total_obs, hazardous_obs, enriched_count, last_run, audit_history, obs_df


# Header
st.title("🌌 ExoWatch — NEO Intelligence Platform")
st.caption("Salle de Contrôle Opérationnelle : Ingestion sous contrat de données, modélisation physique et intelligence décisionnelle.")

# Sidebar
with st.sidebar:
    st.header("⚙️ Contrôle Pipeline")
    st.info("Architecture conforme TP ESEO : SQLite Curated Store + Contrat YAML + Traçabilité Totale")

    if st.button("🚀 Lancer une exécution batch", type="primary", use_container_width=True):
        with st.spinner("Exécution du pipeline (collecte -> validation -> curation -> enrichissement -> scores)..."):
            report = run_pipeline()
            st.success(f"Pipeline complété avec succès ! Statut: {report['quality_status']}")
            st.rerun()

    st.markdown("---")
    st.markdown("**Navigation rapide** : Utilisez le menu ci-dessus pour naviguer entre le Briefing du Jour et les vues analytiques.")

# Fetch data
total_obs, hazardous_obs, enriched_count, last_run, audit_history, obs_df = load_kpi_data()

# KPI Metrics row using Mission Control HUD Cards
col1, col2, col3, col4 = st.columns(4)

with col1:
    render_kpi_card(
        label="Observations Curated",
        value=f"{total_obs:,}",
        delta="Stockage SQLite Immuable",
        status="normal",
        delta_type="neutral"
    )

with col2:
    pct_haz = (hazardous_obs / total_obs * 100) if total_obs > 0 else 0
    status_haz = "critical" if hazardous_obs > 0 else "normal"
    render_kpi_card(
        label="Astéroïdes Dangereux",
        value=f"{hazardous_obs} ({pct_haz:.1f}%)",
        delta="Menace potentielle" if hazardous_obs > 0 else "Aucune menace",
        status=status_haz,
        delta_type="negative" if hazardous_obs > 0 else "positive"
    )

with col3:
    render_kpi_card(
        label="Objets Enrichis IA",
        value=f"{enriched_count}",
        delta="ISRU & Valorisation",
        status="normal",
        delta_type="positive"
    )

with col4:
    status_label = last_run["quality_status"] if last_run else "AUCUN RUN"
    status_kpi = "normal" if status_label == "PASSED" else ("warning" if status_label == "PASSED_WITH_WARNINGS" else "critical")
    render_kpi_card(
        label="Statut Qualité Dernier Run",
        value=status_label,
        delta=f"Exécuté le {last_run['executed_at'][:19] if last_run else 'N/A'}",
        status=status_kpi,
        delta_type="positive" if status_label == "PASSED" else "negative"
    )

st.markdown("---")

# Main visualizations
tab_viz, tab_audit = st.tabs(["📊 Distributions Physiques & Menaces", "📋 Audit Qualité des Exécutions"])

with tab_viz:
    if not obs_df.empty:
        c_chart1, c_chart2 = st.columns(2)

        with c_chart1:
            st.subheader("Distribution des diamètres estimés (km)")
            fig_hist = px.histogram(
                obs_df,
                x="diameter_km_max",
                nbins=30,
                log_y=True,
                labels={"diameter_km_max": "Diamètre max estimé (km)"},
                title="Échelle logarithmique du diamètre",
                color_discrete_sequence=["#00D9FF"]
            )
            apply_plotly_theme(fig_hist)
            st.plotly_chart(fig_hist, use_container_width=True)

        with c_chart2:
            st.subheader("Vitesse relative vs Distance de croisement")
            obs_df["hazardous_label"] = obs_df["is_hazardous"].apply(lambda x: "Dangereux" if x == 1 else "Non dangereux")
            obs_df["size_plot"] = obs_df["diameter_km_max"].clip(lower=0.05, upper=2.0)

            fig_scatter = px.scatter(
                obs_df,
                x="miss_distance_km",
                y="velocity_kmh",
                color="hazardous_label",
                size="size_plot",
                hover_data=["name", "observed_at", "diameter_km_max"],
                color_discrete_map={"Dangereux": "#FF4757", "Non dangereux": "#00D9FF"},
                labels={
                    "miss_distance_km": "Distance de croisement (km)",
                    "velocity_kmh": "Vitesse relative (km/h)",
                    "hazardous_label": "Statut de menace"
                },
                title="Corrélation Vélocité / Proximité"
            )
            apply_plotly_theme(fig_scatter)
            st.plotly_chart(fig_scatter, use_container_width=True)
    else:
        st.info("Aucune donnée disponible. Cliquez sur 'Lancer une exécution batch' dans le menu latéral pour alimenter la base.")

with tab_audit:
    st.subheader("Historique des 5 dernières exécutions (Vue Data Quality Audit)")
    if audit_history:
        audit_df = pd.DataFrame(audit_history)
        st.dataframe(
            audit_df[[
                "run_id", "executed_at", "source_file", "input_rows",
                "accepted_rows", "rejected_rows", "duplicates_removed",
                "quality_status", "duration_seconds"
            ]],
            use_container_width=True
        )
    else:
        st.info("Aucune exécution enregistrée.")
