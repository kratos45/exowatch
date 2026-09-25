"""
Page 1: Surveillance des Objets Dangereux
Visualisation et filtrage des astéroïdes classés potentiellement dangereux.
"""

import streamlit as st
import pandas as pd
import plotly.express as px
from src.db import get_connection

st.set_page_config(page_title="Objets Dangereux - ExoWatch", page_icon="🚨", layout="wide")

st.title("🚨 Surveillance des Objets Potentiellement Dangereux")
st.caption("Données issues de la vue SQL `view_hazardous` (croisement NASA NeoWS + NASA Sentry)")

# Load data from view_hazardous
with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM view_hazardous;")
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

    filtered_df = df_hazardous[
        (df_hazardous["miss_distance_km"] <= max_dist_filter) &
        (df_hazardous["diameter_km_max"] >= min_diameter_filter)
    ].copy()

    # KPI Summary Cards
    col1, col2, col3 = st.columns(3)
    col1.metric("Objets Dangereux Filtrés", len(filtered_df), f"sur {len(df_hazardous)} total")
    closest_dist = filtered_df["miss_distance_km"].min() if not filtered_df.empty else 0
    col2.metric("Plus proche croisement", f"{closest_dist:,.0f} km")
    max_diam = filtered_df["diameter_km_max"].max() if not filtered_df.empty else 0
    col3.metric("Plus grand diamètre", f"{max_diam:.3f} km")

    st.markdown("---")

    # Table of Hazardous Objects
    st.subheader("📋 Liste des Objets Sous Surveillance Rapprochée")

    display_cols = [
        "entity_id", "name", "observed_at", "diameter_km_max",
        "velocity_kmh", "miss_distance_km", "palermo_scale", "torino_scale"
    ]

    st.dataframe(
        filtered_df[display_cols].style.format({
            "diameter_km_max": "{:.3f} km",
            "velocity_kmh": "{:,.1f} km/h",
            "miss_distance_km": "{:,.0f} km",
            "palermo_scale": "{:.2f}",
            "torino_scale": "{:.0f}"
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
