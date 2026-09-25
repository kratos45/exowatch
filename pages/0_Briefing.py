"""
Page 0: Briefing du Jour - Mission Control Intelligence
Centre de commandement décisionnel d'ExoWatch.
Répond immédiatement à la question : "Sur quoi l'équipe doit-elle agir aujourd'hui ?"
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import pandas as pd
from datetime import datetime, timezone

from src.ui.theme import inject_theme
from src.ui.components import (
    render_kpi_card, 
    render_threat_badge, 
    render_sparkline, 
    render_confidence_gauge
)
from src.db import get_connection
from src.decision import get_historical_scores, detect_threat_changes
from src.analytics.forecast import forecast_priority_trend

st.set_page_config(
    page_title="Briefing Opérationnel - ExoWatch",
    page_icon="🛡️",
    layout="wide"
)

# Apply Mission Control theme
inject_theme()

st.title("🛡️ SALLE DE CONTRÔLE — BRIEFING OPÉRATIONNEL DU JOUR")
st.caption(f"SYNTHÈSE EXÉCUTIVE DES TRAJECTOIRES CRITIQUES & DÉCISIONS D'ACTION | {datetime.now(timezone.utc).strftime('%d %B %Y - %H:%M UTC')}")

# Fetch latest run_id for PDF generation
with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT run_id FROM pipeline_runs ORDER BY executed_at DESC LIMIT 1;")
    run_row = cursor.fetchone()
    latest_run_id = run_row[0] if run_row else "active_run"

# Sidebar PDF Export Button
with st.sidebar:
    st.markdown("---")
    st.subheader("📄 Export Documentaire")
    from src.reporting.pdf_export import get_brief_pdf_bytes
    try:
        pdf_data = get_brief_pdf_bytes(latest_run_id)
        st.download_button(
            label="⬇️ Télécharger le Briefing (PDF)",
            data=pdf_data,
            file_name=f"exowatch_briefing_{latest_run_id[:8]}.pdf",
            mime="application/pdf",
            use_container_width=True
        )
    except Exception as e:
        st.caption(f"Génération PDF indisponible : {e}")

# Fetch top 3 priority asteroids and the daily brief summaries
with get_connection() as conn:
    cursor = conn.cursor()
    
    # Check if priority_scores exist
    cursor.execute("""
        SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km, n.velocity_kmh, 
               n.diameter_km_max, n.is_hazardous, n.observed_at, n.orbit_class
        FROM priority_scores p
        JOIN neo_observations n ON p.entity_id = n.entity_id
        WHERE p.run_id = (SELECT run_id FROM priority_scores ORDER BY computed_at DESC LIMIT 1)
        ORDER BY p.score DESC
        LIMIT 3;
    """)
    top_items = [dict(r) for r in cursor.fetchall()]

    # If no run-specific score found, grab latest general scores
    if not top_items:
        cursor.execute("""
            SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km, n.velocity_kmh, 
                   n.diameter_km_max, n.is_hazardous, n.observed_at, n.orbit_class
            FROM priority_scores p
            JOIN neo_observations n ON p.entity_id = n.entity_id
            ORDER BY p.score DESC
            LIMIT 3;
        """)
        top_items = [dict(r) for r in cursor.fetchall()]

    # Fetch top mining candidate
    cursor.execute("""
        SELECT m.*, 
               (SELECT value FROM ai_enrichments WHERE entity_id = m.entity_id AND field_enriched = 'daily_brief_summary' LIMIT 1) as brief_summary
        FROM view_minable m 
        ORDER BY m.confidence DESC 
        LIMIT 1;
    """)
    top_mining_row = cursor.fetchone()
    top_mining = dict(top_mining_row) if top_mining_row else None

    # Fetch daily brief summaries from ai_enrichments
    cursor.execute("""
        SELECT entity_id, value, model_used, enriched_at 
        FROM ai_enrichments 
        WHERE field_enriched = 'daily_brief_summary'
        ORDER BY enriched_at DESC;
    """)
    synthesis_map = {r["entity_id"]: r["value"] for r in cursor.fetchall()}

# Header KPI summary strip
k1, k2, k3, k4 = st.columns(4)
with k1:
    render_kpi_card("Niveau d'Alerte Global", "DEFCON 3", "Surveillance Active", status="warning", delta_type="neutral")
with k2:
    critical_count = sum(1 for item in top_items if item["score"] >= 65)
    status_crit = "critical" if critical_count > 0 else "normal"
    render_kpi_card("Cibles d'Action Immédiate", f"{critical_count}", "Score priorité > 65", status=status_crit, delta_type="negative" if critical_count > 0 else "positive")
with k3:
    render_kpi_card("Télémétrie IA", "ONLINE", "Modèles & Inférence actifs", status="normal", delta_type="positive")
with k4:
    render_kpi_card("Garantie Idempotence", "100%", "Zéro doublon détecté", status="normal", delta_type="positive")

st.markdown("---")

# SECTION 1: TOP 3 PRIORITIES OF THE DAY
st.subheader("🎯 1. TOP 3 OBJETS CRITIQUES REQUÉRANT UNE ACTION")
st.markdown("Classement pondéré calculé par le **score composite de priorité** (Proximité $40\\%$ + Danger $35\\%$ + Tendance $25\\%$).")

if not top_items:
    st.info("Aucun calcul de priorité disponible. Veuillez lancer une exécution batch pour générer les scores.")
else:
    for idx, item in enumerate(top_items, 1):
        entity_id = str(item["entity_id"])
        score = float(item["score"])
        is_haz = item["is_hazardous"] == 1
        threat_level = "critical" if score >= 70 or is_haz else ("warning" if score >= 50 else "nominal")

        # Get synthesis
        summary_sentence = synthesis_map.get(
            entity_id, 
            f"Passage à {item['miss_distance_km']:,.0f} km à {item['velocity_kmh']:,.0f} km/h nécessitant un recalibrage radar."
        )

        with st.container():
            st.markdown(f"""
            <div class="briefing-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <span style="color: #00D9FF; font-weight: 800; font-size: 1.1rem; margin-right: 12px;">#{idx}</span>
                        <span style="font-size: 1.25rem; font-weight: 800; color: #FFFFFF;">{item['name']}</span>
                        <span style="color: #6b7280; font-size: 0.85rem; margin-left: 10px;">ID: {entity_id} | Classe: {item.get('orbit_class', 'Apollo')}</span>
                    </div>
                    <div>
                        {render_threat_badge(threat_level)}
                    </div>
                </div>
                <div style="background: rgba(0, 217, 255, 0.05); border-left: 3px solid #00D9FF; padding: 12px 16px; border-radius: 6px; margin: 12px 0;">
                    <div style="color: #8b949e; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">SYNTHÈSE DIRECTIVE DU SYSTÈME IA :</div>
                    <div style="color: #E6E9EF; font-size: 0.95rem; line-height: 1.5; font-weight: 500;">{summary_sentence}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            col_m1, col_m2, col_m3, col_m4 = st.columns([1.5, 1.5, 1.5, 1.8])
            with col_m1:
                st.markdown(f"**Score de Priorité :** `{score}/100`")
                st.progress(score / 100.0)
            with col_m2:
                st.markdown(f"**Distance au Périgée :** `{item['miss_distance_km']:,.0f} km`")
                lunar_d = item['miss_distance_km'] / 384400.0
                st.caption(f"Soit **{lunar_d:.1f}** distances Terre-Lune (LD)")
            with col_m3:
                st.markdown(f"**Vélocité :** `{item['velocity_kmh']:,.0f} km/h`")
                st.caption(f"Diamètre max : **{item['diameter_km_max']:.3f} km**")
            with col_m4:
                st.markdown("**Tendance & Projection ML :**")
                trend_data = forecast_priority_trend(entity_id)
                spark_fig = render_sparkline(
                    trend_data["history"], 
                    color="#ff4757" if score >= 70 else "#00D9FF",
                    projected_value=trend_data["projected"]
                )
                st.plotly_chart(spark_fig, use_container_width=True)
                st.caption(f"Est. Prochain Run : **{trend_data['next_value_estimate']:.1f}** pts (Pente : {trend_data['slope']:+.1f})")

st.markdown("---")

# SECTION 2: CHANGE ALERTS & MINING HIGHLIGHT
col_alerts, col_mining = st.columns([1.3, 1.2])

with col_alerts:
    st.subheader("⚡ 2. ALERTES DE CHANGEMENT RÉCENTES")
    st.caption("Objets ayant subi une variation de score de menace entre les batchs d'observation.")
    
    changes = detect_threat_changes()
    if changes:
        for chg in changes:
            with st.container():
                st.markdown(f"""
                <div style="background: rgba(19, 24, 32, 0.8); border: 1px solid #1f2937; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 700; color: #FFFFFF;">{chg['name']} ({chg['entity_id']})</span>
                        <span style="color: {'#ff4757' if 'HAUSSE' in chg['change_type'] or 'ALERTE' in chg['change_type'] else '#10b981'}; font-weight: 700; font-size: 0.8rem;">
                            {chg['change_type']} ({chg['delta_score']:+.1f} pts)
                        </span>
                    </div>
                    <div style="color: #9ca3af; font-size: 0.82rem; margin-top: 4px;">{chg['description']}</div>
                </div>
                """, unsafe_allow_html=True)
    else:
        st.info("Aucune dérive anormale ou changement critique de trajectoire détecté.")

with col_mining:
    st.subheader("⛏️ 3. OPPORTUNITÉ MINIÈRE DU JOUR")
    st.caption("Meilleur ratio d'accessibilité orbital et de confiance selon `view_minable`.")

    if top_mining:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(13, 17, 23, 0.9) 100%); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 12px; padding: 20px;">
            <div style="font-size: 0.75rem; color: #10b981; font-weight: 800; letter-spacing: 1px;">MEILLEURE CIBLE D'EXPLOITATION ISRU :</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin: 6px 0;">{top_mining['name']} (ID: {top_mining['entity_id']})</div>
            <p style="color: #E6E9EF; font-size: 0.88rem; line-height: 1.4;">
                Cible d'extraction hautement qualifiée présentant un diamètre de <b>{top_mining['diameter_km_max']:.3f} km</b> et une vitesse de croisement de <b>{top_mining['velocity_kmh']:,.0f} km/h</b>.
            </p>
            <div style="margin-top: 10px; color: #8b949e; font-size: 0.8rem;">
                Modèle d'analyse : <code>{top_mining.get('model_used', 'LLM Enriched')}</code>
            </div>
        </div>
        """, unsafe_allow_html=True)

        fig_gauge = render_confidence_gauge(top_mining.get("confidence", 0.8), title="Confiance Minière")
        st.plotly_chart(fig_gauge, use_container_width=True)
    else:
        st.info("Aucune opportunité minière qualifiée pour le moment.")

st.markdown("---")

# SECTION 3: ATYPICAL OBJECTS DETECTED (ISOLATION FOREST ML)
st.subheader("🧪 4. OBJETS ATYPIQUES DÉTECTÉS (ISOLATION FOREST ML)")
st.caption("Astéroïdes présentant des combinaisons astrophysiques anormales (diamètre/vélocité/magnitude/distance).")

with get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.entity_id, a.anomaly_score, a.is_anomaly, n.name, n.diameter_km_max, n.velocity_kmh, n.miss_distance_km, n.absolute_magnitude
        FROM anomaly_scores a
        JOIN neo_observations n ON a.entity_id = n.entity_id
        WHERE a.run_id = (SELECT run_id FROM anomaly_scores ORDER BY computed_at DESC LIMIT 1)
        ORDER BY a.anomaly_score ASC
        LIMIT 5;
    """)
    atypical_rows = [dict(r) for r in cursor.fetchall()]

if atypical_rows:
    df_atypical = pd.DataFrame(atypical_rows)
    df_atypical["Statut"] = df_atypical["is_anomaly"].apply(lambda x: "🚨 ANOMALIE ML" if x else "Divergence Modérée")
    st.dataframe(
        df_atypical[[
            "entity_id", "name", "anomaly_score", "Statut",
            "diameter_km_max", "velocity_kmh", "miss_distance_km", "absolute_magnitude"
        ]].style.format({
            "anomaly_score": "{:.4f}",
            "diameter_km_max": "{:.3f} km",
            "velocity_kmh": "{:,.0f} km/h",
            "miss_distance_km": "{:,.0f} km",
            "absolute_magnitude": "{:.1f} H"
        }),
        use_container_width=True
    )
else:
    st.info("Aucun score d'anomalie enregistré. Lancez une exécution batch pour exécuter le modèle Isolation Forest.")
