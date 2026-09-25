"use client";

import React from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface SparklineProps {
  history: number[];
  projected?: number[];
  color?: string;
  height?: number;
}

export function Sparkline({
  history = [],
  projected = [],
  color = "#00D9FF",
  height = 50,
}: SparklineProps) {
  if (!history || history.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-[#8b949e] font-mono"
        style={{ height }}
      >
        Données insuffisantes
      </div>
    );
  }

  // Combine history and projected into continuous dataset
  const data: Array<{
    step: string;
    actual?: number;
    projected?: number;
  }> = [];

  history.forEach((val, idx) => {
    data.push({
      step: `T-${history.length - idx}`,
      actual: Number(val.toFixed(1)),
      projected: idx === history.length - 1 ? Number(val.toFixed(1)) : undefined,
    });
  });

  if (projected && projected.length > 0) {
    projected.forEach((val, idx) => {
      data.push({
        step: `T+${idx + 1}`,
        projected: Number(val.toFixed(1)),
      });
    });
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis dataKey="step" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const p = payload[0];
                const isProj = payload[1]?.value !== undefined;
                return (
                  <div className="rounded border border-[#1f2937] bg-[#0A0E14] px-2 py-1 text-xs font-mono text-[#E6E9EF] shadow-md">
                    <span>
                      {isProj
                        ? `Projection: ${payload[1].value}`
                        : `Score: ${p.value}`}
                    </span>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Actual history line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color }}
            isAnimationActive={false}
          />
          {/* Dotted projection line */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={{ r: 2, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
