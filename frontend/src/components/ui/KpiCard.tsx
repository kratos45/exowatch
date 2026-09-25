"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string | number;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  subtitle,
  icon,
}: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1f2937] bg-[#131820] p-5 transition-all duration-300 hover:border-[#00D9FF]/40 hover:shadow-[0_0_20px_rgba(0,217,255,0.15)]">
      <div className="flex items-center justify-between text-[#8b949e]">
        <span className="text-xs font-semibold uppercase tracking-wider font-mono">
          {label}
        </span>
        {icon && <div className="text-[#00D9FF]">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl lg:text-3xl font-bold font-mono text-[#E6E9EF]">
          {value}
        </div>
        {delta !== undefined && (
          <span
            className={`inline-flex items-center text-xs font-medium font-mono px-1.5 py-0.5 rounded ${
              deltaType === "positive"
                ? "bg-[#2ed573]/10 text-[#2ed573]"
                : deltaType === "negative"
                ? "bg-[#ff4757]/10 text-[#ff4757]"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {deltaType === "positive" && <TrendingUp className="mr-0.5 h-3 w-3" />}
            {deltaType === "negative" && <TrendingDown className="mr-0.5 h-3 w-3" />}
            {deltaType === "neutral" && <Minus className="mr-0.5 h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-1 text-xs text-[#8b949e] truncate">{subtitle}</div>
      )}
    </div>
  );
}
