"""
LLM-based enrichment module for ExoWatch.
Estimates space mining feasibility and scientific resource potential.
Results are stored strictly in ai_enrichments to preserve raw measurement integrity.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
from openai import OpenAI
from dotenv import load_dotenv

from src.db import get_connection

load_dotenv()
logger = logging.getLogger(__name__)

PROMPT_VERSION = "v1.2"
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "google/gemini-2.0-flash-001")


def get_llm_client() -> OpenAI:
    """Returns OpenAI client configured with OpenRouter or OpenAI credentials."""
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    return OpenAI(api_key=api_key, base_url=base_url)


def _heuristic_enrichment(neo_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic scientific heuristic fallback if LLM is unavailable."""
    diameter = float(neo_dict.get("diameter_km_max") or 0.1)
    velocity = float(neo_dict.get("velocity_kmh") or 50000.0)
    distance = float(neo_dict.get("miss_distance_km") or 10000000.0)

    # Low velocity + reasonable diameter + close approach = higher mining accessibility
    if velocity < 35000.0 and distance < 15000000.0 and diameter > 0.1:
        potential = "high"
        resource = "Nickel-Iron & Platinum-group"
        acc_score = 0.85
        rationale = "Low delta-V relative velocity and close trajectory significantly reduce mission propellant requirements."
        confidence = 0.82
    elif diameter > 0.05 and distance < 30000000.0:
        potential = "medium"
        resource = "Silicate & Volatiles"
        acc_score = 0.60
        rationale = "Moderate accessibility window with viable mass capture feasibility."
        confidence = 0.75
    else:
        potential = "low"
        resource = "Chondritic Silicates"
        acc_score = 0.30
        rationale = "High delta-V rendezvous cost makes extraction economically unviable with current propulsion tech."
        confidence = 0.70

    return {
        "mining_potential": potential,
        "primary_resource_estimate": resource,
        "accessibility_score": acc_score,
        "scientific_rationale": rationale,
        "confidence": confidence,
        "model_used": "scientific-heuristic-fallback"
    }


def enrich_asteroid(neo_dict: Dict[str, Any], pipeline_run_id: str) -> List[Dict[str, Any]]:
    """
    Enriches an asteroid observation using an LLM (or heuristic fallback).
    Returns list of records ready for ai_enrichments table.
    """
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    entity_id = str(neo_dict.get("entity_id"))

    system_prompt = (
        "You are an expert planetary geologist and space mission flight dynamicist for ExoWatch. "
        "Analyze the physical characteristics of Near Earth Objects (NEOs) to evaluate their in-situ resource "
        "utilization (ISRU) and asteroid mining potential. "
        "Always respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "mining_potential": "high" | "medium" | "low" | "none",\n'
        '  "primary_resource_estimate": "string (e.g. Nickel-Iron, Water Ice, Rare Earth Elements)",\n'
        '  "accessibility_score": float between 0.0 and 1.0,\n'
        '  "scientific_rationale": "concise rationale under 100 words",\n'
        '  "confidence": float between 0.0 and 1.0\n'
        "}"
    )

    user_prompt = (
        f"Analyze this Near Earth Object:\n"
        f"- Name: {neo_dict.get('name')}\n"
        f"- ID: {neo_dict.get('entity_id')}\n"
        f"- Estimated Max Diameter: {neo_dict.get('diameter_km_max')} km\n"
        f"- Relative Velocity: {neo_dict.get('velocity_kmh')} km/h\n"
        f"- Miss Distance: {neo_dict.get('miss_distance_km')} km\n"
        f"- Absolute Magnitude: {neo_dict.get('absolute_magnitude')}\n"
        f"- Orbit Class: {neo_dict.get('orbit_class', 'Apollo')}\n"
    )

    parsed_result = None
    model_used = DEFAULT_MODEL

    if api_key and not api_key.startswith("your_"):
        try:
            client = get_llm_client()
            response = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=300,
                timeout=12.0
            )
            raw_text = response.choices[0].message.content.strip()
            # Extract JSON block
            json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if json_match:
                parsed_result = json.loads(json_match.group(0))
                model_used = response.model or DEFAULT_MODEL
            else:
                logger.warning(f"Could not extract JSON from LLM response for {entity_id}")
        except Exception as e:
            logger.warning(f"LLM enrichment call failed for {entity_id} ({e}). Falling back to heuristic.")

    if not parsed_result:
        parsed_result = _heuristic_enrichment(neo_dict)
        model_used = parsed_result.get("model_used", "heuristic-fallback")

    confidence = float(parsed_result.get("confidence", 0.75))
    enrichment_records = [
        {
            "entity_id": entity_id,
            "field_enriched": "mining_potential",
            "value": str(parsed_result.get("mining_potential", "medium")),
            "confidence": confidence,
            "model_used": model_used,
            "prompt_version": PROMPT_VERSION,
            "pipeline_run_id": pipeline_run_id
        },
        {
            "entity_id": entity_id,
            "field_enriched": "primary_resource",
            "value": str(parsed_result.get("primary_resource_estimate", "Nickel-Iron")),
            "confidence": confidence,
            "model_used": model_used,
            "prompt_version": PROMPT_VERSION,
            "pipeline_run_id": pipeline_run_id
        },
        {
            "entity_id": entity_id,
            "field_enriched": "accessibility_score",
            "value": str(parsed_result.get("accessibility_score", 0.5)),
            "confidence": confidence,
            "model_used": model_used,
            "prompt_version": PROMPT_VERSION,
            "pipeline_run_id": pipeline_run_id
        },
        {
            "entity_id": entity_id,
            "field_enriched": "scientific_rationale",
            "value": str(parsed_result.get("scientific_rationale", "")),
            "confidence": confidence,
            "model_used": model_used,
            "prompt_version": PROMPT_VERSION,
            "pipeline_run_id": pipeline_run_id
        }
    ]

    return enrichment_records


def store_enrichments(records: List[Dict[str, Any]]):
    """Inserts enrichment rows into SQLite ai_enrichments table."""
    if not records:
        return

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO ai_enrichments (
                entity_id, field_enriched, value, confidence, model_used, prompt_version, pipeline_run_id
            ) VALUES (
                :entity_id, :field_enriched, :value, :confidence, :model_used, :prompt_version, :pipeline_run_id
            )
        """, records)
        conn.commit()
    logger.info(f"Saved {len(records)} enrichment records to ai_enrichments table.")
