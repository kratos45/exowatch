"""
Data validation module for ExoWatch.
Applies quality rules defined in config/data_contract.yaml.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple, List, Dict, Any
import yaml
import pandas as pd


def load_contract(contract_path: Path = Path("config/data_contract.yaml")) -> dict:
    """Loads YAML data contract."""
    with open(contract_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate_r1_entity_id_not_null(series: pd.Series) -> pd.Series:
    """R1: entity_id must not be null or empty."""
    return series.notnull() & (series.astype(str).str.strip() != "") & (series.astype(str).str.lower() != "nan")


def validate_r2_observed_at(series: pd.Series, max_date: str = "today") -> pd.Series:
    """R2: observed_at must be valid YYYY-MM-DD and not in the future."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d") if max_date == "today" else max_date
    parsed = pd.to_datetime(series, format="%Y-%m-%d", errors="coerce")
    is_valid_format = parsed.notnull()
    is_not_future = series.astype(str) <= today_str
    return is_valid_format & is_not_future


def validate_r3_diameter(series: pd.Series, min_val: float = 0.0001, max_val: float = 1000.0) -> pd.Series:
    """R3: diameter_km_min must be strictly positive and within realistic physical bounds."""
    numeric_s = pd.to_numeric(series, errors="coerce")
    return numeric_s.notnull() & (numeric_s >= min_val) & (numeric_s <= max_val)


def validate_r4_velocity(series: pd.Series, min_val: float = 1.0, max_val: float = 200000.0) -> pd.Series:
    """R4: velocity_kmh plausible range (flag rule)."""
    numeric_s = pd.to_numeric(series, errors="coerce")
    return numeric_s.notnull() & (numeric_s >= min_val) & (numeric_s <= max_val)


def validate_r6_miss_distance(series: pd.Series, min_val: float = 0.0) -> pd.Series:
    """R6: miss_distance_km must be non-negative."""
    numeric_s = pd.to_numeric(series, errors="coerce")
    return numeric_s.notnull() & (numeric_s >= min_val)


def validate_dataset(
    df: pd.DataFrame, 
    contract_path: Path = Path("config/data_contract.yaml")
) -> Tuple[pd.DataFrame, pd.DataFrame, List[Dict[str, Any]]]:
    """
    Validates a DataFrame against contract rules.
    Returns:
        accepted_df: DataFrame of valid rows
        rejected_df: DataFrame of rejected rows with 'rejection_reason'
        audit_metrics: list of execution metrics per rule
    """
    if df.empty:
        return df.copy(), pd.DataFrame(columns=list(df.columns) + ["rejection_reason"]), []

    working_df = df.copy()
    reasons = pd.Series([""] * len(working_df), index=working_df.index)
    audit_metrics = []

    # R1: entity_id_not_null
    m_r1 = validate_r1_entity_id_not_null(working_df["entity_id"]) if "entity_id" in working_df.columns else pd.Series(False, index=working_df.index)
    failed_r1 = ~m_r1
    reasons.loc[failed_r1 & (reasons == "")] = "R1: entity_id is null or empty"
    audit_metrics.append({
        "rule_id": "R1",
        "name": "entity_id_not_null",
        "passed": int(m_r1.sum()),
        "failed": int(failed_r1.sum()),
        "action": "reject"
    })

    # R2: observed_at_valid_date
    m_r2 = validate_r2_observed_at(working_df["observed_at"]) if "observed_at" in working_df.columns else pd.Series(False, index=working_df.index)
    failed_r2 = ~m_r2
    reasons.loc[failed_r2 & (reasons == "")] = "R2: observed_at invalid format or future date"
    audit_metrics.append({
        "rule_id": "R2",
        "name": "observed_at_valid_date",
        "passed": int(m_r2.sum()),
        "failed": int(failed_r2.sum()),
        "action": "reject"
    })

    # R3: diameter_positive
    m_r3 = validate_r3_diameter(working_df["diameter_km_min"]) if "diameter_km_min" in working_df.columns else pd.Series(False, index=working_df.index)
    failed_r3 = ~m_r3
    reasons.loc[failed_r3 & (reasons == "")] = "R3: diameter_km_min missing or out of plausible range"
    audit_metrics.append({
        "rule_id": "R3",
        "name": "diameter_positive",
        "passed": int(m_r3.sum()),
        "failed": int(failed_r3.sum()),
        "action": "reject"
    })

    # R4: velocity_plausible_range (FLAG only - does not reject)
    m_r4 = validate_r4_velocity(working_df["velocity_kmh"]) if "velocity_kmh" in working_df.columns else pd.Series(True, index=working_df.index)
    failed_r4 = ~m_r4
    working_df["velocity_flagged"] = failed_r4
    audit_metrics.append({
        "rule_id": "R4",
        "name": "velocity_plausible_range",
        "passed": int(m_r4.sum()),
        "failed": int(failed_r4.sum()),
        "action": "flag"
    })

    # R6: miss_distance_positive
    m_r6 = validate_r6_miss_distance(working_df["miss_distance_km"]) if "miss_distance_km" in working_df.columns else pd.Series(False, index=working_df.index)
    failed_r6 = ~m_r6
    reasons.loc[failed_r6 & (reasons == "")] = "R6: miss_distance_km is negative or missing"
    audit_metrics.append({
        "rule_id": "R6",
        "name": "miss_distance_positive",
        "passed": int(m_r6.sum()),
        "failed": int(failed_r6.sum()),
        "action": "reject"
    })

    # Split accepted / rejected
    is_rejected = reasons != ""
    rejected_df = working_df[is_rejected].copy()
    rejected_df["rejection_reason"] = reasons[is_rejected]

    accepted_df = working_df[~is_rejected].copy()

    # R5: unique_business_key (deduplicate within the accepted dataset)
    if "entity_id" in accepted_df.columns and "observed_at" in accepted_df.columns:
        initial_accepted = len(accepted_df)
        accepted_df = accepted_df.drop_duplicates(subset=["entity_id", "observed_at"], keep="last")
        dedup_count = initial_accepted - len(accepted_df)
    else:
        dedup_count = 0

    audit_metrics.append({
        "rule_id": "R5",
        "name": "unique_business_key",
        "passed": len(accepted_df),
        "failed": dedup_count,
        "action": "deduplicate"
    })

    return accepted_df, rejected_df, audit_metrics