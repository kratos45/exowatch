"""
Page 4: Rapports d'Exécution & Métriques de Qualité
Inspection des artefacts JSON de run et évolution temporelle des rejets.
"""

import streamlit as st
import pandas as pd
import json
import plotly.express as px
from pathlib import Path
from src.db import get_connection

st.set_page_config(page_title="Rapports d'Exécution - ExoWatch", page_icon="📜", layout="wide")

st.title("📜 Rapports d'Exécution & Métriques de Qualité")
st.caption("Audit rétrospectif des batchs d'ingestion et contrôle de conformité contractuelle.")

REPORTS_DIR = Path("reports")
report_files = sorted(REPORTS_DIR.glob("run_report_*.json"), reverse=True)

# 1. Historical Trends from SQLite pipeline_runs
st.subheader("📈 Évolution Temporelle des Flux de Données")

with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT run_id, executed_at, input_rows, accepted_rows, rejected_rows, duplicates_removed, quality_status, duration_seconds
        FROM pipeline_runs
        ORDER BY executed_at ASC;
    """)
    run_history = [dict(r) for r in cursor.fetchall()]

if run_history:
    df_history = pd.DataFrame(run_history)
    df_history["run_short"] = df_history["run_id"].str[:8] + " (" + df_history["executed_at"].str[11:19] + ")"

    # Stacked bar chart
    fig_bar = px.bar(
        df_history,
        x="run_short",
        y=["accepted_rows", "rejected_rows", "duplicates_removed"],
        title="Ventilation des lignes par exécution (Acceptées vs Rejetées vs Doublons)",
        labels={"value": "Nombre de lignes", "run_short": "Exécution", "variable": "Statut de la ligne"},
        color_discrete_map={
            "accepted_rows": "#10B981",
            "rejected_rows": "#EF4444",
            "duplicates_removed": "#F59E0B"
        }
    )
    fig_bar.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font_color="#E6EDF3",
        barmode="stack"
    )
    st.plotly_chart(fig_bar, use_container_width=True)
else:
    st.info("Aucune donnée d'exécution disponible pour tracer l'historique.")

st.markdown("---")

# 2. Detailed Single Run JSON Inspector
st.subheader("🔎 Rapport Détaillé d'une Exécution (Fichier JSON)")

if not report_files:
    st.info("Aucun fichier de rapport JSON trouvé dans le répertoire reports/.")
else:
    selected_file = st.selectbox(
        "Sélectionner un rapport de run :",
        options=report_files,
        format_func=lambda p: p.name
    )

    if selected_file:
        with open(selected_file, "r", encoding="utf-8") as f:
            report_data = json.load(f)

        # Overview cards
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Run ID", report_data.get("run_id", "N/A")[:8])
        c2.metric("Statut Qualité", report_data.get("quality_status", "N/A"))
        c3.metric("Lignes Entrantes", report_data.get("input_rows", 0))
        c4.metric("Durée du Run", f"{report_data.get('duration_seconds', 0):.2f}s")

        tab_rules, tab_rejections, tab_raw_json = st.tabs([
            "📋 Bilan des Règles Qualité",
            "🚫 Échantillon des Rejets",
            "💾 Fichier Brut JSON"
        ])

        with tab_rules:
            metrics_list = report_data.get("audit_metrics", [])
            if metrics_list:
                df_rules = pd.DataFrame(metrics_list)
                st.dataframe(df_rules, use_container_width=True)
            else:
                st.info("Aucune métrique de règle spécifique disponible dans ce rapport.")

        with tab_rejections:
            rejections = report_data.get("sample_rejections", [])
            if rejections:
                st.dataframe(pd.DataFrame(rejections), use_container_width=True)
            else:
                st.success("✅ Aucune ligne rejetée lors de cette exécution.")

        with tab_raw_json:
            st.json(report_data)
            st.download_button(
                label="⬇️ Télécharger le rapport JSON",
                data=json.dumps(report_data, indent=2),
                file_name=selected_file.name,
                mime="application/json"
            )
