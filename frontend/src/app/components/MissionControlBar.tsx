"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Radio, ShieldAlert, Sparkles, Bell, Info } from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

interface MissionControlProps {
  activeTab: string;
  selectedEntityName?: string;
  timelineYear?: number;
}

export default function MissionControlBar({ activeTab, selectedEntityName, timelineYear = 0 }: MissionControlProps) {
  const [copilotInsight, setCopilotInsight] = useState<string>(
    "Veille radar active. 2,407 objets géocroiseurs sous suivi continu."
  );

  useEffect(() => {
    axios
      .post(`${API_URL}/copilot/insight`, {
        active_tab: activeTab,
        selected_entity_name: selectedEntityName,
        timeline_year: timelineYear,
      })
      .then((res) => {
        if (res.data.insights?.length > 0) {
          setCopilotInsight(res.data.insights[0].message);
        }
      })
      .catch(() => {});
  }, [activeTab, selectedEntityName, timelineYear]);

  return (
    <div className="w-full bg-gradient-to-r from-gray-900 via-cyan-950 to-gray-900 text-white rounded-xl p-3 border-2 border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)] mb-4 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs">
      {/* Live Status Indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-red-600/90 text-white px-2.5 py-1 rounded font-extrabold uppercase text-[10px] tracking-wider animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]">
          <ShieldAlert size={13} /> DEFCON 3 : VIGILANCE ACTIVE
        </div>
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
          <Radio size={14} className="animate-spin text-cyan-300" />
          <span>MISSION CONTROL LIVE</span>
        </div>
      </div>

      {/* Copilot Contextual Insight Feed */}
      <div className="flex-1 px-4 text-center md:text-left text-cyan-100 flex items-center gap-2 overflow-hidden">
        <Sparkles size={14} className="text-amber-400 flex-shrink-0 animate-bounce" />
        <span className="text-[11px] truncate">
          <strong className="text-amber-300 font-bold">Copilote IA : </strong>
          {copilotInsight}
        </span>
      </div>

      {/* Real-time Ticker */}
      <div className="flex items-center gap-2 text-[10px] text-gray-300 font-bold">
        <span className="bg-white/10 px-2 py-0.5 rounded border border-cyan-400/40">2,407 NEOs</span>
        <span className="bg-white/10 px-2 py-0.5 rounded border border-cyan-400/40">PAGERANK GDS</span>
      </div>
    </div>
  );
}
