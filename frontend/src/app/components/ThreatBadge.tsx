"use client";

import React from "react";

export type ThreatLevel = "nominal" | "surveillance" | "elevated" | "critical";

interface ThreatBadgeProps {
  level?: ThreatLevel | string;
  score?: number;
  label?: string;
  className?: string;
}

export default function ThreatBadge({ level = "nominal", score, label, className = "" }: ThreatBadgeProps) {
  // Infer level if score is provided
  let normalizedLevel: ThreatLevel = "nominal";
  if (typeof level === "string") {
    const l = level.toLowerCase();
    if (l.includes("critique") || l.includes("critical") || l.includes("danger")) normalizedLevel = "critical";
    else if (l.includes("élevé") || l.includes("elevated") || l.includes("haut")) normalizedLevel = "elevated";
    else if (l.includes("modéré") || l.includes("surveillance") || l.includes("moyen")) normalizedLevel = "surveillance";
    else normalizedLevel = "nominal";
  }

  if (score !== undefined) {
    if (score >= 3.0) normalizedLevel = "critical";
    else if (score >= 1.5) normalizedLevel = "elevated";
    else if (score >= 0.5) normalizedLevel = "surveillance";
    else normalizedLevel = "nominal";
  }

  const configs = {
    nominal: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800/60",
      dot: "bg-emerald-500",
      glow: "shadow-[0_0_8px_rgba(16,185,129,0.3)]",
      defaultText: "ORBITE NOMINALE",
      pulse: false,
    },
    surveillance: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800/60",
      dot: "bg-amber-500",
      glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
      defaultText: "SURVEILLANCE",
      pulse: false,
    },
    elevated: {
      bg: "bg-orange-50 dark:bg-orange-950/40",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800/60",
      dot: "bg-orange-500",
      glow: "shadow-[0_0_12px_rgba(249,115,22,0.4)]",
      defaultText: "RISQUE ÉLEVÉ",
      pulse: true,
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-300 dark:border-red-800",
      dot: "bg-red-600",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.5)]",
      defaultText: "CRITIQUE (PHA)",
      pulse: true,
    },
  };

  const cfg = configs[normalizedLevel];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-technical font-extrabold uppercase border tracking-wider transition ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.glow} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      <span>{label || cfg.defaultText}</span>
      {score !== undefined && <span className="opacity-75 font-normal">({score.toFixed(2)})</span>}
    </span>
  );
}
