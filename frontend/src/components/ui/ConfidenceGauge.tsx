"use client";

import React from "react";

interface ConfidenceGaugeProps {
  confidence: number; // 0 to 1
  label?: string;
  size?: number;
}

export function ConfidenceGauge({
  confidence,
  label = "Confiance IA",
  size = 110,
}: ConfidenceGaugeProps) {
  const percentage = Math.round(Math.min(Math.max(confidence, 0), 1) * 100);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  let color = "#2ed573";
  if (percentage < 40) color = "#ff4757";
  else if (percentage < 70) color = "#ffa502";

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="rotate-[-90deg]" width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1f2937"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 0.8s ease-in-out",
              filter: `drop-shadow(0 0 6px ${color}88)`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-bold text-[#E6E9EF]">
            {percentage}%
          </span>
        </div>
      </div>
      <span className="mt-1 text-xs text-[#8b949e] font-mono">{label}</span>
    </div>
  );
}
