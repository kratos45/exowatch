"""
Mission Control Design System & CSS Injection for ExoWatch.
"""

import streamlit as st


def inject_theme():
    """Injects Mission Control HUD styling and fonts across Streamlit pages."""
    st.markdown("""
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet">
    
    <style>
    /* Global Typography & Font override */
    html, body, [class*="css"], .stMarkdown, p, div, span {
        font-family: 'JetBrains Mono', monospace !important;
    }

    /* Radar Grid Background */
    .stApp {
        background-color: #0A0E14;
        background-image: radial-gradient(circle at 1px 1px, #1a2332 1px, transparent 0);
        background-size: 24px 24px;
        color: #E6E9EF;
    }

    /* HUD Headers with letter-spacing */
    h1, h2, h3, h4, h5, h6 {
        letter-spacing: 1.5px !important;
        font-family: 'JetBrains Mono', monospace !important;
        font-weight: 700 !important;
        color: #E6E9EF !important;
        text-transform: uppercase;
    }
    
    h1 {
        border-bottom: 1px solid rgba(0, 217, 255, 0.25);
        padding-bottom: 8px;
        margin-bottom: 20px !important;
    }

    /* Metric Cards - Mission Control Instrument Panel */
    .metric-card {
        background: linear-gradient(135deg, #131820 0%, #0d1117 100%);
        border: 1px solid #1f2937;
        border-radius: 12px;
        padding: 18px 22px;
        box-shadow: 0 0 20px rgba(0, 217, 255, 0.08);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        margin-bottom: 14px;
    }
    .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.6), transparent);
    }
    .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 30px rgba(0, 217, 255, 0.25);
        border-color: rgba(0, 217, 255, 0.4);
    }

    .metric-card-normal {
        border-left: 4px solid #00D9FF;
    }
    .metric-card-warning {
        border-left: 4px solid #f59e0b;
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.08);
    }
    .metric-card-warning:hover {
        box-shadow: 0 0 30px rgba(245, 158, 11, 0.25);
        border-color: rgba(245, 158, 11, 0.5);
    }
    .metric-card-critical {
        border-left: 4px solid #ff4757;
        box-shadow: 0 0 20px rgba(255, 71, 87, 0.12);
    }
    .metric-card-critical:hover {
        box-shadow: 0 0 30px rgba(255, 71, 87, 0.35);
        border-color: rgba(255, 71, 87, 0.6);
    }

    .metric-label {
        font-size: 0.78rem;
        color: #8b949e;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-weight: 500;
        margin-bottom: 6px;
    }
    .metric-value {
        font-size: 1.85rem;
        font-weight: 800;
        color: #FFFFFF;
        letter-spacing: 0.5px;
        line-height: 1.2;
    }
    .metric-delta {
        font-size: 0.75rem;
        margin-top: 6px;
        font-weight: 600;
    }
    .metric-delta-positive { color: #10b981; }
    .metric-delta-negative { color: #ff4757; }
    .metric-delta-neutral { color: #8b949e; }

    /* Threat Badges */
    .threat-badge {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        border-radius: 20px;
        padding: 3px 12px;
        text-align: center;
    }
    .threat-nominal {
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .threat-warning {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .threat-critical {
        color: #ff4757;
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid #ff4757;
        box-shadow: 0 0 10px rgba(255, 71, 87, 0.4);
        animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.55; transform: scale(0.98); }
    }

    /* Briefing Highlight Card */
    .briefing-card {
        background: linear-gradient(135deg, #161e2e 0%, #0d121c 100%);
        border: 1px solid #2d3748;
        border-radius: 14px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 4px 25px rgba(0, 0, 0, 0.5);
    }
    
    /* Sidebar Mission Control styling */
    [data-testid="stSidebar"] {
        background-color: #0E131B !important;
        border-right: 1px solid #1f2937;
    }

    /* Dataframe & Tables */
    div[data-testid="stDataFrame"] {
        border: 1px solid #1f2937;
        border-radius: 8px;
    }
    </style>
    """, unsafe_allow_html=True)
