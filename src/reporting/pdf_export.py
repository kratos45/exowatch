"""
Mission Control PDF Export module for ExoWatch.
Generates an executive briefing PDF using ReportLab with tables, KPIs, and LLM directives.
"""

from pathlib import Path
from datetime import datetime, timezone
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from src.db import get_connection

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def generate_mission_brief_pdf(run_id: str) -> Path:
    """
    Generates an executive PDF report for a given pipeline run_id.
    Saves to reports/brief_<run_id>.pdf and returns the Path.
    """
    pdf_path = REPORTS_DIR / f"brief_{run_id}.pdf"

    # Fetch run metadata
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_runs WHERE run_id = ?;", (run_id,))
        run_row = cursor.fetchone()
        run_data = dict(run_row) if run_row else {
            "run_id": run_id, "executed_at": datetime.now(timezone.utc).isoformat(),
            "quality_status": "PASSED", "input_rows": 0, "accepted_rows": 0, "duration_seconds": 0.0
        }

        # Fetch top 3 priorities
        cursor.execute("""
            SELECT p.entity_id, p.score, n.name, n.miss_distance_km, n.velocity_kmh, n.diameter_km_max, n.is_hazardous
            FROM priority_scores p
            JOIN neo_observations n ON p.entity_id = n.entity_id
            WHERE p.run_id = ?
            ORDER BY p.score DESC
            LIMIT 3;
        """, (run_id,))
        top_priorities = [dict(r) for r in cursor.fetchall()]

        if not top_priorities:
            cursor.execute("""
                SELECT p.entity_id, p.score, n.name, n.miss_distance_km, n.velocity_kmh, n.diameter_km_max, n.is_hazardous
                FROM priority_scores p
                JOIN neo_observations n ON p.entity_id = n.entity_id
                ORDER BY p.score DESC
                LIMIT 3;
            """)
            top_priorities = [dict(r) for r in cursor.fetchall()]

        # Fetch executive LLM summaries
        cursor.execute("""
            SELECT entity_id, value FROM ai_enrichments
            WHERE pipeline_run_id = ? AND field_enriched = 'daily_brief_summary';
        """, (run_id,))
        summaries = {r["entity_id"]: r["value"] for r in cursor.fetchall()}

        # Fetch top mining opportunity
        cursor.execute("SELECT * FROM view_minable ORDER BY confidence DESC LIMIT 1;")
        mining_row = cursor.fetchone()
        mining_data = dict(mining_row) if mining_row else None

    # Setup ReportLab Document
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a")
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b")
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=14,
        spaceAfter=8
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=body_style,
        fontName="Helvetica-Bold"
    )

    story = []

    # Title & Header
    story.append(Paragraph("EXOWATCH — MISSION CONTROL EXECUTIVE BRIEF", title_style))
    story.append(Paragraph(f"Rapport opérationnel de surveillance NEO | Run ID : {run_id[:8]}... | Date : {run_data['executed_at'][:19]} UTC", subtitle_style))
    story.append(Spacer(1, 15))

    # Meta KPI Table
    kpi_data = [
        ["STATUT QUALITÉ", "LIGNES ANALYSÉES", "LIGNES RETENUES", "DURÉE BATCH"],
        [run_data["quality_status"], str(run_data["input_rows"]), str(run_data["accepted_rows"]), f"{run_data['duration_seconds']}s"]
    ]
    t_kpi = Table(kpi_data, colWidths=[130, 130, 130, 130])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f1f5f9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1"))
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 15))

    # Section 1: Top 3 Priorities
    story.append(Paragraph("1. CIBLES D'ACTION PRIORITAIRE DU JOUR", section_style))
    story.append(Paragraph("Classement pondéré par le score composite d'urgence (Proximité 40% + Menace 35% + Tendance 25%).", body_style))
    story.append(Spacer(1, 8))

    table_data = [["#", "NOM DE L'OBJET", "ID", "DISTANCE (KM)", "VITESSE (KM/H)", "DIAMÈTRE", "SCORE"]]
    for idx, p in enumerate(top_priorities, 1):
        table_data.append([
            str(idx),
            p["name"],
            str(p["entity_id"]),
            f"{p['miss_distance_km']:,.0f}",
            f"{p['velocity_kmh']:,.0f}",
            f"{p['diameter_km_max']:.3f} km",
            f"{p['score']}/100"
        ])

    t_priorities = Table(table_data, colWidths=[25, 140, 65, 95, 85, 65, 45])
    t_priorities.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1"))
    ]))
    story.append(t_priorities)
    story.append(Spacer(1, 12))

    # Section 2: Executive Directives (LLM Syntheses)
    story.append(Paragraph("2. DIRECTIVES OPÉRATIONNELLES (SYNTHÈSE IA)", section_style))
    for p in top_priorities:
        eid = str(p["entity_id"])
        directive = summaries.get(eid, f"Passage à {p['miss_distance_km']:,.0f} km. Maintenir la surveillance orbitale.")
        story.append(Paragraph(f"<b>{p['name']} (Score : {p['score']}/100) :</b> {directive}", body_style))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 10))

    # Section 3: Space Mining Opportunity
    story.append(Paragraph("3. OPPORTUNITÉ MINIÈRE ET VALORISATION IN-SITU (ISRU)", section_style))
    if mining_data:
        mining_txt = (
            f"<b>Meilleure cible identifiée :</b> {mining_data['name']} (ID: {mining_data['entity_id']}).<br/>"
            f"<b>Potentiel Minier :</b> {mining_data['mining_assessment'].upper()} | "
            f"<b>Confiance du Modèle :</b> {mining_data['confidence']*100:.1f}% | "
            f"<b>Diamètre :</b> {mining_data['diameter_km_max']:.3f} km | "
            f"<b>Vitesse relative :</b> {mining_data['velocity_kmh']:,.0f} km/h.<br/>"
            f"<i>Avertissement : Données issues de modélisation par intelligence artificielle, non mesurées in-situ.</i>"
        )
        story.append(Paragraph(mining_txt, body_style))
    else:
        story.append(Paragraph("Aucune opportunité minière qualifiée pour cette exécution.", body_style))

    # Build PDF document
    doc.build(story)
    return pdf_path


def get_brief_pdf_bytes(run_id: str) -> bytes:
    """Generates the mission brief PDF and returns raw bytes for web streaming."""
    pdf_path = generate_mission_brief_pdf(run_id)
    with open(pdf_path, "rb") as f:
        return f.read()
