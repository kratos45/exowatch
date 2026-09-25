"use client";

import React from "react";

interface ConfidenceMeterProps {
  score: number; // 0 to 100
  size?: number; // size in pixels (default 64)
  strokeWidth?: number;
  label?: string;
  showBasis?: boolean;
  basisText?: string;
}

export default function ConfidenceMeter({
  score,
  size = 64,
  strokeWidth = 6,
  label = "Confiance IA",
  showBasis = false,
  basisText,
}: ConfidenceMeterProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score || 85));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Color determination
  let strokeColor = "#10b981"; // Emerald for >85%
  let textColor = "text-emerald-500";
  let glowColor = "rgba(16, 185, 129, 0.4)";

  if (clampedScore < 65) {
    strokeColor = "#f97316"; // Orange
    textColor = "text-orange-500";
    glowColor = "rgba(249, 115, 22, 0.4)";
  } else if (clampedScore < 78) {
    strokeColor = "#f59e0b"; // Amber
    textColor = "text-amber-500";
    glowColor = "rgba(245, 158, 11, 0.4)";
  } else if (clampedScore < 90) {
    strokeColor = "#06b6d4"; // Cyan
    textColor = "text-cyan-500";
    glowColor = "rgba(6, 182, 212, 0.4)";
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-800"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
          />
        </svg>

        {/* Inner percentage display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`font-technical font-black text-xs ${textColor}`}>
            {Math.round(clampedScore)}%
          </span>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">
          {label}
        </div>
        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
          {clampedScore >= 85
            ? "Haute Fidélité"
            : clampedScore >= 70
            ? "Fidélité Modérée"
            : "Inférence Approximative"}
        </div>
        {showBasis && basisText && (
          <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-[180px] mt-0.5">
            {basisText}
          </div>
        )}
      </div>
    </div>
  );
}
