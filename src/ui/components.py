"""
Reusable UI components for Mission Control Dashboard.
KPI cards, confidence gauges, threat badges, and sparkline trends.
"""

import streamlit as st
import plotly.graph_objects as go
from typing import List, Optional


def apply_plotly_theme(fig: go.Figure) -> go.Figure:
    """Applies Mission Control dark theme and JetBrains Mono typography to Plotly figures."""
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="JetBrains Mono, monospace", color="#E6E9EF"),
        margin=dict(l=20, r=20, t=40, b=20)
    )
    return fig


def render_kpi_card(
    label: str, 
    value: str, 
    delta: Optional[str] = None, 
    status: str = "normal", 
    delta_type: str = "positive"
):
    """
    Renders custom HTML HUD instrument card.
    status: 'normal' | 'warning' | 'critical'
    delta_type: 'positive' | 'negative' | 'neutral'
    """
    status_class = f"metric-card-{status}"
    delta_class = f"metric-delta-{delta_type}"
    
    delta_html = f'<div class="metric-delta {delta_class}">{delta}</div>' if delta else ''
    
    html = f"""
    <div class="metric-card {status_class}">
        <div class="metric-label">{label}</div>
        <div class="metric-value">{value}</div>
        {delta_html}
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_threat_badge(level: str) -> str:
    """
    Generates HTML string for a threat badge with optional CSS pulse.
    level: 'critical' | 'warning' | 'nominal'
    """
    lvl = level.lower().strip()
    if lvl in ["critical", "critique", "danger", "hazardous", "elevé", "high"]:
        badge_class = "threat-critical"
        label = "MENACE CRITIQUE"
    elif lvl in ["warning", "vigilance", "surveillance", "medium", "modéré"]:
        badge_class = "threat-warning"
        label = "VIGILANCE ACCRUE"
    else:
        badge_class = "threat-nominal"
        label = "NOMINAL / SÛR"

    return f'<span class="threat-badge {badge_class}">{label}</span>'


def render_confidence_gauge(value: float, title: str = "Indice de Confiance IA") -> go.Figure:
    """
    Renders Plotly dark theme gauge indicator [0.0 - 1.0] with red->yellow->green gradient.
    """
    val_clamped = max(0.0, min(1.0, float(value)))
    pct = round(val_clamped * 100, 1)

    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=pct,
        number={"suffix": "%", "font": {"family": "JetBrains Mono", "color": "#FFFFFF", "size": 24}},
        title={"text": title, "font": {"family": "JetBrains Mono", "size": 13, "color": "#8b949e"}},
        gauge={
            "axis": {"range": [0, 100], "tickwidth": 1, "tickcolor": "#4b5563"},
            "bar": {"color": "#00D9FF", "thickness": 0.25},
            "bgcolor": "rgba(255, 255, 255, 0.05)",
            "borderwidth": 1,
            "bordercolor": "#1f2937",
            "steps": [
                {"range": [0, 40], "color": "rgba(255, 71, 87, 0.25)"},
                {"range": [40, 75], "color": "rgba(245, 158, 11, 0.25)"},
                {"range": [75, 100], "color": "rgba(16, 185, 129, 0.25)"}
            ],
            "threshold": {
                "line": {"color": "#00D9FF", "width": 3},
                "thickness": 0.75,
                "value": pct
            }
        }
    ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="JetBrains Mono, monospace", color="#E6E9EF"),
        height=180,
        margin=dict(l=15, r=15, t=30, b=10)
    )
    return fig


def render_sparkline(values: List[float], color: str = "#00D9FF", height: int = 40) -> go.Figure:
    """
    Renders an axis-less mini sparkline for quick trend visualization.
    """
    if not values or len(values) < 2:
        values = values or [50.0]
        values = values * 2

    x = list(range(len(values)))
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=x,
        y=values,
        mode="lines",
        line=dict(color=color, width=2),
        hoverinfo="y",
        fill="tozeroy",
        fillcolor=f"rgba(0, 217, 255, 0.15)" if color == "#00D9FF" else "rgba(255, 71, 87, 0.15)"
    ))
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        height=height,
        xaxis=dict(visible=False, showgrid=False),
        yaxis=dict(visible=False, showgrid=False)
    )
    return fig
