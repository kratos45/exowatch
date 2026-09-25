import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import pandas as pd
import plotly.express as px

from src.ui.theme import inject_theme
from src.ui.components import render_kpi_card, render_threat_badge, apply_plotly_theme
from src.db import get_connection

st.set_page_config(page_title="Objets Dangereux - ExoWatch", page_icon="🚨", layout="wide")

# Apply Mission Control Theme
inject_theme()

st.title("🚨 SURVEILLANCE DES OBJETS POTENTIELLEMENT DANGEREUX")
st.caption("TELEMETRIE CROISÉE NASA NEOWS & SENTRY RISK DATABASE (VUE SQL `view_hazardous`)")

# Load data from view_hazardous + latest anomaly score
with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            h.*,
            (SELECT a.anomaly_score FROM anomaly_scores a WHERE a.entity_id = h.entity_id ORDER BY a.computed_at DESC LIMIT 1) AS anomaly_score,
            (SELECT a.is_anomaly FROM anomaly_scores a WHERE a.entity_id = h.entity_id ORDER BY a.computed_at DESC LIMIT 1) AS is_anomaly
        FROM view_hazardous h;
    """)
    rows = [dict(r) for r in cursor.fetchall()]

df_hazardous = pd.DataFrame(rows)

if df_hazardous.empty:
    st.success("✅ Aucun objet dangereux enregistré dans le jeu de données actuel.")
else:
    # Sidebar filters
    st.sidebar.header("🔍 Filtres d'Analyse")

    max_dist_available = float(df_hazardous["miss_distance_km"].max())
    min_dist_available = float(df_hazardous["miss_distance_km"].min())

    max_dist_filter = st.sidebar.slider(
        "Distance maximale de croisement (km)",
        min_value=min_dist_available,
        max_value=max_dist_available,
        value=max_dist_available,
        format="%.0f km"
    )

    min_diameter_filter = st.sidebar.slider(
        "Diamètre max minimum (km)",
        min_value=0.0,
        max_value=float(df_hazardous["diameter_km_max"].max()),
        value=0.0,
        step=0.05
    )

    only_anomalies = st.sidebar.checkbox("Afficher uniquement les anomalies ML", value=False)

    filtered_df = df_hazardous[
        (df_hazardous["miss_distance_km"] <= max_dist_filter) &
        (df_hazardous["diameter_km_max"] >= min_diameter_filter)
    ].copy()

    if only_anomalies and "is_anomaly" in filtered_df.columns:
        filtered_df = filtered_df[filtered_df["is_anomaly"] == 1]

    # KPI Summary Cards using HUD Design System
    col1, col2, col3 = st.columns(3)
    with col1:
        render_kpi_card("Objets Dangereux Filtrés", f"{len(filtered_df)}", f"sur {len(df_hazardous)} total", status="critical", delta_type="negative")
    with col2:
        closest_dist = filtered_df["miss_distance_km"].min() if not filtered_df.empty else 0
        render_kpi_card("Périgée le Plus Proche", f"{closest_dist:,.0f} km", f"{closest_dist/384400:.1f} LD (Dist. Lune)", status="warning", delta_type="neutral")
    with col3:
        max_diam = filtered_df["diameter_km_max"].max() if not filtered_df.empty else 0
        render_kpi_card("Diamètre Maximal Estimé", f"{max_diam:.3f} km", "Seuil d'extinction régionale", status="critical", delta_type="negative")

    st.markdown("---")

    # Table of Hazardous Objects
    st.subheader("📋 Liste des Objets Sous Surveillance Rapprochée")

    display_cols = [
        "entity_id", "name", "observed_at", "diameter_km_max",
        "velocity_kmh", "miss_distance_km", "palermo_scale", "torino_scale"
    ]
    if "anomaly_score" in filtered_df.columns:
        display_cols.append("anomaly_score")

    st.dataframe(
        filtered_df[display_cols].style.format({
            "diameter_km_max": lambda x: f"{x:.3f} km" if pd.notna(x) and x is not None else "—",
            "velocity_kmh": lambda x: f"{x:,.1f} km/h" if pd.notna(x) and x is not None else "—",
            "miss_distance_km": lambda x: f"{x:,.0f} km" if pd.notna(x) and x is not None else "—",
            "palermo_scale": lambda x: f"{x:.2f}" if pd.notna(x) and x is not None else "—",
            "torino_scale": lambda x: f"{int(x)}" if pd.notna(x) and x is not None else "0",
            "anomaly_score": lambda x: f"{x:.4f}" if pd.notna(x) and x is not None else "—"
        }),
        use_container_width=True
    )

    # Detailed Inspector
    st.markdown("---")
    st.subheader("🔬 Fiche Détaillée d'un Astéroïde")
    selected_name = st.selectbox("Sélectionner un astéroïde à inspecter :", filtered_df["name"].unique())

    if selected_name:
        ast_row = filtered_df[filtered_df["name"] == selected_name].iloc[0]
        
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown(f"**Identifiant NeoWS :** `{ast_row['entity_id']}`")
            st.markdown(f"**Date d'approche :** `{ast_row['observed_at']}`")
            st.markdown(f"**Classe Orbitale :** `{ast_row.get('orbit_class', 'Apollo')}`")
        with c2:
            st.markdown(f"**Vitesse Relative :** `{ast_row['velocity_kmh']:,.1f} km/h`")
            st.markdown(f"**Distance Manquée :** `{ast_row['miss_distance_km']:,.0f} km`")
            lunar_dist = ast_row['miss_distance_km'] / 384400.0
            st.markdown(f"**Distance en unités lunaires (LD) :** `{lunar_dist:.2f} LD`")
        with c3:
            torino = ast_row.get("torino_scale")
            palermo = ast_row.get("palermo_scale")
            if torino is not None and torino > 0:
                st.error(f"⚠️ Échelle de Turin : Niveau {int(torino)}")
            else:
                st.info("Échelle de Turin : Niveau 0 (Risque standard)")

            if palermo is not None and palermo > -2:
                st.warning(f"Échelle de Palerme : {palermo:.2f}")
            else:
                st.caption(f"Échelle de Palerme : {palermo if palermo is not None else 'N/A'}")
