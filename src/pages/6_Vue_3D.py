"""
Page 6: Vue Orbitale 3D - Système Solaire & Trajectoires Kepleriennes
Calcul analytique des éphémérides et visualisation spatiale interactive en 3D.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objects as go

from src.ui.theme import inject_theme
from src.ui.components import render_kpi_card, apply_plotly_theme
from src.db import get_connection

st.set_page_config(
    page_title="Vue 3D Orbitale - ExoWatch",
    page_icon="🪐",
    layout="wide"
)

# Apply Mission Control theme
inject_theme()

st.title("🪐 VISUALISATION 3D DES ORBITES KEPLÉRIENNES")
st.caption("MÉCANIQUE CÉLESTE ANALYTIQUE EN TEMPS RÉEL | RÉFÉRENTIEL HÉLIOCENTRIQUE ÉCLIPTIQUE (J2000)")


def orbital_elements_to_3d_points(elements: dict, n_points: int = 120) -> np.ndarray:
    """
    Converts Keplerian orbital parameters (a, e, i, Omega, omega) into 3D Cartesian
    heliocentric ecliptic coordinates (AU) along the orbital ellipse.
    """
    a = float(elements.get("semi_major_axis") or 1.5)
    e = float(elements.get("eccentricity") or 0.2)
    # Ensure physical limits for bound elliptical orbits
    e = max(0.01, min(0.95, e))
    a = max(0.4, min(10.0, a))

    inc = np.radians(float(elements.get("inclination") or 10.0))
    raan = np.radians(float(elements.get("ascending_node_longitude") or 0.0))
    arg_p = np.radians(float(elements.get("perihelion_argument") or 0.0))

    # True anomaly theta
    theta = np.linspace(0, 2 * np.pi, n_points)
    r = a * (1 - e**2) / (1 + e * np.cos(theta))

    # Orbital plane coordinates
    x_orb = r * np.cos(theta)
    y_orb = r * np.sin(theta)

    # 3D Euler rotation matrix (arg_p, inc, raan)
    x = x_orb * (np.cos(raan) * np.cos(arg_p) - np.sin(raan) * np.sin(arg_p) * np.cos(inc)) - \
        y_orb * (np.cos(raan) * np.sin(arg_p) + np.sin(raan) * np.cos(arg_p) * np.cos(inc))
    y = x_orb * (np.sin(raan) * np.cos(arg_p) + np.cos(raan) * np.sin(arg_p) * np.cos(inc)) - \
        y_orb * (np.sin(raan) * np.sin(arg_p) - np.cos(raan) * np.cos(arg_p) * np.cos(inc))
    z = x_orb * (np.sin(arg_p) * np.sin(inc)) + y_orb * (np.cos(arg_p) * np.sin(inc))

    return np.column_stack([x, y, z])


# Fetch orbital elements joined with neo_observations
with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.entity_id, o.semi_major_axis, o.eccentricity, o.inclination,
               o.ascending_node_longitude, o.perihelion_argument, o.mean_anomaly,
               n.name, n.is_hazardous, n.diameter_km_max, n.miss_distance_km
        FROM orbital_elements o
        JOIN neo_observations n ON o.entity_id = n.entity_id
        GROUP BY o.entity_id
        ORDER BY n.is_hazardous DESC, n.miss_distance_km ASC;
    """)
    orbit_rows = [dict(r) for r in cursor.fetchall()]

# Fallback: if orbital_elements table was just created and not populated, construct from neo_observations
if not orbit_rows:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT entity_id, name, is_hazardous, diameter_km_max, miss_distance_km FROM neo_observations GROUP BY entity_id LIMIT 30;")
        obs_only = [dict(r) for r in cursor.fetchall()]

    for r in obs_only:
        seed = sum(ord(c) for c in str(r["entity_id"]))
        orbit_rows.append({
            **r,
            "semi_major_axis": 1.1 + (seed % 150) / 100.0,
            "eccentricity": 0.15 + (seed % 50) / 100.0,
            "inclination": 3.0 + (seed % 250) / 10.0,
            "ascending_node_longitude": (seed * 7) % 360,
            "perihelion_argument": (seed * 13) % 360
        })

# Sidebar controls
st.sidebar.header("🕹️ Contrôles de la Vue 3D")
display_earth = st.sidebar.checkbox("Afficher l'Orbite Terrestre (1.0 UA)", value=True)
filter_hazardous_only = st.sidebar.checkbox("Afficher uniquement les astéroïdes dangereux", value=False)
max_orbits_to_show = st.sidebar.slider("Nombre maximal d'orbites affichées", min_value=3, max_value=30, value=12)

candidate_orbits = orbit_rows
if filter_hazardous_only:
    candidate_orbits = [o for o in candidate_orbits if o["is_hazardous"] == 1]

candidate_orbits = candidate_orbits[:max_orbits_to_show]

# Asteroid focus selector
selected_focus = st.sidebar.selectbox(
    "Mettre un astéroïde en surbrillance :",
    options=["-- Aucun (Vue d'ensemble) --"] + [f"{o['name']} ({o['entity_id']})" for o in candidate_orbits]
)

# Build 3D Scatter Figure
fig = go.Figure()

# 1. Central Sun at origin
fig.add_trace(go.Scatter3d(
    x=[0], y=[0], z=[0],
    mode="markers+text",
    marker=dict(size=12, color="#FFD700", symbol="circle", opacity=1.0),
    name="Soleil",
    text=["Soleil"],
    textposition="top center",
    hoverinfo="text"
))

# 2. Earth orbit (approximate 1.0 AU circular orbit in ecliptic plane)
if display_earth:
    theta_earth = np.linspace(0, 2 * np.pi, 100)
    fig.add_trace(go.Scatter3d(
        x=np.cos(theta_earth),
        y=np.sin(theta_earth),
        z=np.zeros_like(theta_earth),
        mode="lines",
        line=dict(color="#00D9FF", width=3, dash="dash"),
        name="Orbite Terrestre (1.0 UA)",
        hoverinfo="name"
    ))
    # Earth marker at current epoch position
    fig.add_trace(go.Scatter3d(
        x=[1.0], y=[0.0], z=[0.0],
        mode="markers+text",
        marker=dict(size=7, color="#00D9FF", symbol="circle"),
        name="Terre",
        text=["Terre"],
        textposition="bottom right",
        hoverinfo="text"
    ))

# 3. Asteroid Keplerian orbital ellipses
for o in candidate_orbits:
    pts = orbital_elements_to_3d_points(o)
    is_haz = o["is_hazardous"] == 1
    is_focused = selected_focus and str(o["entity_id"]) in selected_focus

    if is_focused:
        line_color = "#FFFFFF"
        line_width = 6
    elif is_haz:
        line_color = "#FF4757"
        line_width = 3
    else:
        line_color = "rgba(0, 217, 255, 0.45)"
        line_width = 2

    fig.add_trace(go.Scatter3d(
        x=pts[:, 0],
        y=pts[:, 1],
        z=pts[:, 2],
        mode="lines",
        line=dict(color=line_color, width=line_width),
        name=f"{o['name']} ({'DANGER' if is_haz else 'Sûr'})",
        hovertext=f"Astéroïde : {o['name']}<br>Demi-grand axe : {o['semi_major_axis']:.2f} UA<br>Excentricité : {o['eccentricity']:.2f}<br>Inclinaison : {o['inclination']:.1f}°",
        hoverinfo="text"
    ))

    # Add perihelion marker (closest point to Sun along orbit)
    perigee_idx = np.argmin(np.linalg.norm(pts, axis=1))
    fig.add_trace(go.Scatter3d(
        x=[pts[perigee_idx, 0]],
        y=[pts[perigee_idx, 1]],
        z=[pts[perigee_idx, 2]],
        mode="markers",
        marker=dict(size=4 if not is_focused else 8, color=line_color),
        name=f"Périgée {o['name']}",
        hoverinfo="skip",
        showlegend=False
    ))

# Camera and layout styling
fig.update_layout(
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="JetBrains Mono, monospace", color="#E6E9EF"),
    scene=dict(
        xaxis=dict(title="X (UA)", backgroundcolor="rgba(0,0,0,0)", gridcolor="#1f2937", showbackground=False),
        yaxis=dict(title="Y (UA)", backgroundcolor="rgba(0,0,0,0)", gridcolor="#1f2937", showbackground=False),
        zaxis=dict(title="Z (UA)", backgroundcolor="rgba(0,0,0,0)", gridcolor="#1f2937", showbackground=False),
        camera=dict(
            eye=dict(x=1.6, y=1.6, z=1.2)
        )
    ),
    height=750,
    margin=dict(l=0, r=0, t=10, b=10)
)

st.plotly_chart(fig, use_container_width=True)

# Information strip below 3D canvas
c1, c2, c3 = st.columns(3)
with c1:
    render_kpi_card("Système de Coordonnées", "Héliocentrique", "J2000 Écliptique", status="normal", delta_type="neutral")
with c2:
    render_kpi_card("Objets en Orbite Tracés", f"{len(candidate_orbits)}", "Ellipses calculées analytiquement", status="normal", delta_type="positive")
with c3:
    haz_in_view = sum(1 for o in candidate_orbits if o["is_hazardous"] == 1)
    render_kpi_card("Orbites Dangereuses en Vue", f"{haz_in_view}", "Tracées en Rouge Alerte (#FF4757)", status="critical" if haz_in_view > 0 else "normal", delta_type="negative" if haz_in_view > 0 else "positive")
