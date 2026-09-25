"use client";

import React from "react";

interface ThreatBadgeProps {
  score?: number;
  isHazardous?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ThreatBadge({
  score,
  isHazardous,
  label,
  size = "md",
}: ThreatBadgeProps) {
  let text = label;
  let bgClass = "bg-[#2ed573]/15 text-[#2ed573] border-[#2ed573]/40";
  let pulse = false;

  if (score !== undefined) {
    if (score >= 75) {
      text = text || `CRITIQUE (${score.toFixed(0)})`;
      bgClass = "bg-[#ff4757]/20 text-[#ff4757] border-[#ff4757]/50";
      pulse = true;
    } else if (score >= 50) {
      text = text || `ÉLEVÉ (${score.toFixed(0)})`;
      bgClass = "bg-[#ffa502]/20 text-[#ffa502] border-[#ffa502]/50";
    } else if (score >= 25) {
      text = text || `MODÉRÉ (${score.toFixed(0)})`;
      bgClass = "bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/40";
    } else {
      text = text || `FAIBLE (${score.toFixed(0)})`;
      bgClass = "bg-[#2ed573]/15 text-[#2ed573] border-[#2ed573]/40";
    }
  } else if (isHazardous !== undefined) {
    if (isHazardous) {
      text = text || "DANGEREUX (PHA)";
      bgClass = "bg-[#ff4757]/20 text-[#ff4757] border-[#ff4757]/50";
      pulse = true;
    } else {
      text = text || "NON MENAÇANT";
      bgClass = "bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/40";
    }
  }

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3.5 py-1.5 text-sm font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium uppercase tracking-wider ${
        sizeClasses[size]
      } ${bgClass} ${pulse ? "animate-pulse shadow-[0_0_12px_rgba(255,71,87,0.3)]" : ""}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
