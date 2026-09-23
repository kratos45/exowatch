import os
import math
from pathlib import Path
import sqlite3

import streamlit as st
import plotly.graph_objects as go
from dotenv import load_dotenv
from google import genai

import src.db as db

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

st.set_page_config(page_title="ExoWatch & NEOs", layout="wide")
st.title("🔭 ExoWatch — Explorateur d'Exoplanètes & Géocroiseurs")
st.caption("Données de la NASA — Exoplanet Archive et NeoWs")

DB_FILE = Path("data/curated/exowatch.db")

@st.cache_data
def load_data(table_name):
    if not DB_FILE.exists():
        return []
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

if not DB_FILE.exists():
    st.error("Base de données introuvable. Lance `python src\\transform.py`.")
    st.stop()

# ---------- Sidebar : Source de données ----------
st.sidebar.header("Source de données")
data_source = st.sidebar.radio(
    "Type d'objets",
    ["exoplanets", "neo_objects"],
    format_func=lambda x: "Exoplanètes" if x == "exoplanets" else "Astéroïdes Géocroiseurs (NEOs)"
)

rows = load_data(data_source)

if not rows:
    st.warning(f"Aucune donnée trouvée pour {data_source}.")
    st.stop()

def safe_log(v):
    try:
        f = float(v)
        return math.log10(f) if f > 0 else None
    except (ValueError, TypeError):
        return None

if data_source == "exoplanets":
    st.sidebar.header("Filtres Exoplanètes")
    score_type = st.sidebar.radio(
        "Score d'atypicité",
        ["anomaly_score_ml", "anomaly_score_heuristic"],
        format_func=lambda x: "Isolation Forest (ML)" if x == "anomaly_score_ml" else "Heuristique (statistique)",
    )
    min_score = st.sidebar.slider("Score minimum", 0.0, 1.0, 0.0, 0.01)
    methods = sorted(set(r["discoverymethod"] for r in rows if r["discoverymethod"]))
    selected_methods = st.sidebar.multiselect("Méthode de détection", methods, default=methods)

    filtered = [
        r for r in rows
        if r["discoverymethod"] in selected_methods and float(r[score_type]) >= min_score
    ]
    st.sidebar.write(f"**{len(filtered)}** objets affichés sur {len(rows)}")

    # Graphe Exoplanètes
    xs, ys, zs, colors, names, texts = [], [], [], [], [], []
    for r in filtered:
        lx, ly, lz = safe_log(r["pl_rade"]), safe_log(r["pl_bmasse"]), safe_log(r["pl_orbper"])
        if None in (lx, ly, lz): continue
        xs.append(lx)
        ys.append(ly)
        zs.append(lz)
        colors.append(float(r[score_type]))
        names.append(r["entity_id"])
        texts.append(
            f"{r['entity_id']}<br>Rayon: {r['pl_rade']} R⊕<br>Masse: {r['pl_bmasse']} M⊕"
            f"<br>Période: {r['pl_orbper']} j<br>Score: {r[score_type]}"
        )
    
    fig = go.Figure(data=[go.Scatter3d(
        x=xs, y=ys, z=zs, mode="markers",
        marker=dict(size=4, color=colors, colorscale="Inferno", colorbar=dict(title="Score"), showscale=True),
        text=texts, hoverinfo="text"
    )])
    fig.update_layout(scene=dict(xaxis_title="log10(rayon, R⊕)", yaxis_title="log10(masse, M⊕)", zaxis_title="log10(période, j)"), height=700, margin=dict(l=0, r=0, b=0, t=0))
    st.plotly_chart(fig, use_container_width=True)

else:
    # NEOs
    st.sidebar.header("Filtres NEOs")
    danger_filter = st.sidebar.radio("Risque", ["Tous", "Dangereux (PHA)", "Non dangereux"])
    
    filtered = []
    for r in rows:
        is_pha = bool(r["is_potentially_hazardous_asteroid"])
        if danger_filter == "Dangereux (PHA)" and not is_pha: continue
        if danger_filter == "Non dangereux" and is_pha: continue
        filtered.append(r)
        
    st.sidebar.write(f"**{len(filtered)}** objets affichés sur {len(rows)}")
    
    xs, ys, zs, colors, names, texts = [], [], [], [], [], []
    for r in filtered:
        # 3D: semi_major_axis, eccentricity, orbital_period (log)
        lx = safe_log(r["semi_major_axis"])
        ly = float(r["eccentricity"]) if r["eccentricity"] is not None else None
        lz = safe_log(r["orbital_period"])
        
        if None in (lx, ly, lz): continue
        
        xs.append(lx)
        ys.append(ly)
        zs.append(lz)
        pha = int(r["is_potentially_hazardous_asteroid"])
        colors.append(pha) # 1 ou 0
        names.append(r["name"])
        danger_text = "Oui" if pha else "Non"
        texts.append(
            f"{r['name']}<br>Axe (UA): {r['semi_major_axis']}<br>Excentricité: {r['eccentricity']}"
            f"<br>Période (j): {r['orbital_period']}<br>Danger: {danger_text}"
        )
        
    fig = go.Figure(data=[go.Scatter3d(
        x=xs, y=ys, z=zs, mode="markers",
        marker=dict(
            size=5, color=colors, colorscale=[[0, 'blue'], [1, 'red']], 
            colorbar=dict(title="Danger", tickvals=[0, 1], ticktext=["Non", "Oui"]), showscale=True
        ),
        text=texts, hoverinfo="text"
    )])
    fig.update_layout(scene=dict(xaxis_title="log10(Axe, UA)", yaxis_title="Excentricité", zaxis_title="log10(Période, j)"), height=700, margin=dict(l=0, r=0, b=0, t=0))
    st.plotly_chart(fig, use_container_width=True)

# ---------- Sélection + explication IA ----------
st.subheader("Explorer un candidat")

if not names:
    st.warning("Aucun objet ne correspond aux filtres actuels.")
    st.stop()

selected_name = st.selectbox("Choisir un objet", sorted(list(set(names))))
if data_source == "exoplanets":
    selected_row = next(r for r in filtered if r["entity_id"] == selected_name)
else:
    selected_row = next(r for r in filtered if r["name"] == selected_name)

col1, col2 = st.columns(2)

with col1:
    st.write("**Métadonnées**")
    keys_to_show = [
        "hostname", "discoverymethod", "disc_year", "pl_orbper",
        "pl_rade", "pl_bmasse", "st_teff", "sy_dist",
        "anomaly_score_heuristic", "anomaly_score_ml",
    ] if data_source == "exoplanets" else [
        "entity_id", "name", "semi_major_axis", "eccentricity", "orbital_period",
        "perihelion_distance", "aphelion_distance", "is_potentially_hazardous_asteroid",
        "estimated_diameter_min", "estimated_diameter_max", "close_approach_date",
        "relative_velocity_kmh", "miss_distance_lunar"
    ]
    
    st.write("**Carte de Profil (Caractéristiques)**")
    
    if data_source == "exoplanets":
        c1, c2 = st.columns(2)
        c1.metric("Rayon (R⊕)", selected_row.get('pl_rade', 'N/A'))
        c2.metric("Masse (M⊕)", selected_row.get('pl_bmasse', 'N/A'))
        
        c3, c4 = st.columns(2)
        c3.metric("Période Orbitale", f"{selected_row.get('pl_orbper', 'N/A')} j")
        c4.metric("Température (Étoile)", f"{selected_row.get('st_teff', 'N/A')} K")
        
        st.info(f"**Découverte :** {selected_row.get('disc_year')} par {selected_row.get('discoverymethod')}\n\n**Étoile hôte :** {selected_row.get('hostname')}\n\n**Distance :** {selected_row.get('sy_dist')} pc")
    else:
        # NEOs Profile Card
        c1, c2 = st.columns(2)
        pha = "Oui ⚠️" if selected_row.get("is_potentially_hazardous_asteroid") else "Non ✅"
        c1.metric("Dangerosité (PHA)", pha)
        
        d_min = selected_row.get('estimated_diameter_min')
        d_max = selected_row.get('estimated_diameter_max')
        diam_text = f"{d_min:.0f} - {d_max:.0f} m" if d_min and d_max else "N/A"
        c2.metric("Taille estimée", diam_text)
        
        c3, c4 = st.columns(2)
        vel = selected_row.get('relative_velocity_kmh')
        c3.metric("Vitesse (km/h)", f"{float(vel):,.0f}" if vel else "N/A")
        
        miss = selected_row.get('miss_distance_lunar')
        c4.metric("Distance frôlement", f"{float(miss):.1f} dist. lunaire" if miss else "N/A")
        
        ca_date = selected_row.get('close_approach_date')
        st.info(f"**Prochain passage proche :** {ca_date if ca_date else 'Inconnu'}\n\n**Demi-grand axe :** {selected_row.get('semi_major_axis')} UA\n\n**Excentricité :** {selected_row.get('eccentricity')}")

with col2:
    if st.button("🤖 Expliquer avec l'IA"):
        if not API_KEY:
            st.error("Clé GEMINI_API_KEY manquante dans le fichier .env")
        else:
            with st.spinner("Génération de l'explication..."):
                client = genai.Client(api_key=API_KEY)
                
                if data_source == "exoplanets":
                    prompt = f"""Tu es un assistant en astrophysique. Voici les caractéristiques d'une exoplanète
détectée comme statistiquement atypique par un pipeline de détection d'anomalies
(Isolation Forest sur rayon, masse et période orbitale en échelle log) :

Nom : {selected_row['entity_id']}
Étoile hôte : {selected_row.get('hostname')}
Méthode de détection : {selected_row.get('discoverymethod')}
Année de découverte : {selected_row.get('disc_year')}
Rayon : {selected_row.get('pl_rade')} rayons terrestres
Masse : {selected_row.get('pl_bmasse')} masses terrestres
Période orbitale : {selected_row.get('pl_orbper')} jours
Température de l'étoile : {selected_row.get('st_teff')} K
Score d'atypicité (Isolation Forest) : {selected_row.get('anomaly_score_ml')}
Score d'atypicité (heuristique statistique) : {selected_row.get('anomaly_score_heuristic')}

En 4-5 phrases maximum, explique pourquoi cette combinaison de caractéristiques est
statistiquement rare parmi les exoplanètes connues, et propose une hypothèse plausible
sur la nature de cet objet (ex: Jupiter chaude, planète en formation, naine brune,
orbite très excentrique...). Reste factuel et prudent, précise qu'il s'agit d'une
hypothèse à vérifier, pas d'une certitude."""
                else:
                    danger = "OUI (Potentially Hazardous Asteroid)" if selected_row.get("is_potentially_hazardous_asteroid") else "NON"
                    prompt = f"""Tu es un assistant en astrophysique et géocroiseurs (NEOs). Voici les caractéristiques d'un astéroïde
proche de la Terre :

Nom : {selected_row['name']}
ID NASA : {selected_row['entity_id']}
Demi-grand axe : {selected_row.get('semi_major_axis')} UA
Excentricité : {selected_row.get('eccentricity')}
Période orbitale : {selected_row.get('orbital_period')} jours
Périhélie : {selected_row.get('perihelion_distance')} UA
Aphélie : {selected_row.get('aphelion_distance')} UA
Potentiellement dangereux pour la Terre : {danger}

En 4-5 phrases maximum, explique ce que ces paramètres orbitaux signifient pour la trajectoire
de cet astéroïde dans le système solaire intérieur (par exemple, croise-t-il l'orbite de la Terre ou
d'autres planètes ?), et explique pourquoi il est classé (ou non) comme dangereux. Reste factuel."""
                
                response = client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=prompt,
                )
                st.info(response.text)

# ---------- Visualisation 3D (Simulation) ----------
st.divider()
st.subheader("Visualisation 3D (Simulation)")

import src.sim3d as sim3d
import streamlit.components.v1 as components

if data_source == "exoplanets":
    st.write(f"**Système 3D de {selected_row['entity_id']}** (Simulation WebGL interactive)")
    radius = selected_row.get("pl_rade")
    teff = selected_row.get("st_teff")
    try:
        r_val = float(radius) if radius else 1.0
    except:
        r_val = 1.0
    try:
        t_val = float(teff) if teff else 5000
    except:
        t_val = 5000
        
    html_code = sim3d.get_exo_scene_html(r_val, t_val, selected_row['entity_id'])
    components.html(html_code, height=600)

else:
    st.write(f"**Orbite dynamique de {selected_row['name']}** (Simulation WebGL interactive)")
    a = selected_row.get("semi_major_axis")
    e = selected_row.get("eccentricity")
    is_pha = bool(selected_row.get("is_potentially_hazardous_asteroid"))
    
    if a and e:
        try:
            a_val = float(a)
            e_val = float(e)
            
            html_code = sim3d.get_neo_scene_html(a_val, e_val, is_pha, selected_row['name'])
            components.html(html_code, height=600)
        except Exception as ex:
            st.warning(f"Données orbitales invalides pour l'affichage 3D : {ex}")
    else:
        st.info("Données orbitales (demi-grand axe ou excentricité) manquantes pour tracer l'orbite.")

# ---------- Tableau de données ----------
st.divider()
st.subheader("Données (Tableau)")
st.dataframe(filtered)

# ---------- Nouveau Dataset Sentry ----------
if data_source == "neo_objects":
    st.divider()
    st.subheader("⚠️ Alertes NASA JPL Sentry (Risques d'Impacts)")
    st.write("Ce tableau est issu d'un dataset additionnel (Sentry) répertoriant les astéroïdes ayant une probabilité non nulle de percuter la Terre.")
    sentry_rows = load_data("sentry_impact_risks")
    if sentry_rows:
        # Trier par probabilité d'impact (ip) décroissante
        sentry_rows = sorted(sentry_rows, key=lambda x: float(x['ip'] if x['ip'] else 0), reverse=True)
        st.dataframe(sentry_rows[:50]) # Afficher les 50 plus dangereux
    else:
        st.info("Aucune donnée Sentry trouvée.")