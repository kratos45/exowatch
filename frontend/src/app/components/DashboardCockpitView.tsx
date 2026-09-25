"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useExoWatchStore } from "../store";
import ThreatBadge from "./ThreatBadge";
import {
  Compass,
  AlertTriangle,
  Pickaxe,
  Share2,
  Bot,
  Radio,
  Flame,
  Activity,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

export default function DashboardCockpitView() {
  const { setActiveTab, setSelectedTargetName, addToast } = useExoWatchStore();
  const [topThreats, setTopThreats] = useState<any[]>([]);
  const [miningTop, setMiningTop] = useState<any[]>([]);
  const [dailyBriefing, setDailyBriefing] = useState<string>(
    "Bulletin Spatial : Surveillance active de 2,407 astéroïdes géocroiseurs. Aucune trajectoire n'intersecte la sphère de Hill terrestre dans les 7 prochains jours. Deux candidats métalliques présentent un Delta-V optimal pour les campagnes d'échantillonnage."
  );

  useEffect(() => {
    // Load top impacts and mining targets
    Promise.all([
      axios.get(`${API_URL}/impacts`),
      axios.get(`${API_URL}/mining`),
    ]).then(([impRes, minRes]) => {
      setTopThreats(impRes.data.slice(0, 5));
      setMiningTop(minRes.data.slice(0, 5));
    }).catch(() => {});
  }, []);

  const handleSelectObject = (name: string, tabToGo: string = "detail") => {
    setSelectedTargetName(name);
    setActiveTab(tabToGo);
    addToast({
      type: "info",
      title: "Cible Sélectionnée",
      message: `${name} est maintenant verrouillé dans le cockpit.`,
    });
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Top Global KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-technical">
        {/* KPI 1 */}
        <div className="hologram-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-[11px] uppercase font-bold tracking-wider">OBJETS SUIVIS</span>
            <Radio size={16} className="text-cyan-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-2">2,407</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> +12 détectés ce mois
          </div>
        </div>

        {/* KPI 2 */}
        <div className="hologram-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-[11px] uppercase font-bold tracking-wider">CROISEMENTS CRITIQUES</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600 dark:text-red-500 mt-2">14</div>
          <div className="text-[10px] text-red-500 font-bold mt-1">Sentry Impact Watch</div>
        </div>

        {/* KPI 3 */}
        <div className="hologram-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-[11px] uppercase font-bold tracking-wider">CIBLES MINIÈRES (ΔV &lt; 5km/s)</span>
            <Pickaxe size={16} className="text-cyan-500" />
          </div>
          <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-2">42</div>
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold mt-1">Richesse Fer/Nickel/Platine</div>
        </div>

        {/* KPI 4 */}
        <div className="hologram-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-[11px] uppercase font-bold tracking-wider">KNOWLEDGE GRAPH (NEO4J)</span>
            <Share2 size={16} className="text-purple-500" />
          </div>
          <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">13.5k</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-1">Nœuds & Relations Spatiales</div>
        </div>
      </div>

      {/* Daily AI Briefing Banner */}
      <div className="hologram-card p-5 border-l-4 border-l-cyan-500">
        <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1.5 font-technical">
          <Sparkles size={14} className="text-cyan-500 animate-spin-slow" />
          <span>Bulletin Exécutif Quotidien (Synthèse IA ExoWatch)</span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
          {dailyBriefing}
        </p>
      </div>

      {/* Main Dual Grid: Top Threats vs Mining Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top Threats Leaderboard */}
        <div className="hologram-card p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm uppercase font-technical">
                Top Menaces Géocroiseurs (PageRank Centrality)
              </h3>
            </div>
            <button
              onClick={() => setActiveTab("timeline")}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-bold flex items-center gap-1 font-technical"
            >
              Timeline ➔
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {topThreats.map((t, i) => (
              <div
                key={i}
                onClick={() => handleSelectObject(t.name, "impact")}
                className="p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 hover:border-red-300 dark:hover:border-red-800 bg-gray-50/50 dark:bg-slate-900/50 hover:bg-red-50/30 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-technical font-black text-gray-400 text-sm">#{i + 1}</span>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-technical">
                      Énergie : <span className="font-bold text-red-500">{t.megatons} Mt</span> • Diamètre : {t.diameter} km
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ThreatBadge score={t.threat_centrality ? t.threat_centrality * 1000 : 2.5} />
                  <ChevronRight size={15} className="text-gray-400 group-hover:text-red-500 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: High-Value Space Mining Targets */}
        <div className="hologram-card p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Pickaxe className="w-5 h-5 text-cyan-500" />
              <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm uppercase font-technical">
                Cibles d'Exploitation Minière Prioritaires
              </h3>
            </div>
            <button
              onClick={() => setActiveTab("mining")}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-bold flex items-center gap-1 font-technical"
            >
              Comparateur ➔
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {miningTop.map((m, i) => (
              <div
                key={i}
                onClick={() => handleSelectObject(m.name, "mining")}
                className="p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 hover:border-cyan-300 dark:hover:border-cyan-800 bg-gray-50/50 dark:bg-slate-900/50 hover:bg-cyan-50/30 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-technical font-black text-gray-400 text-sm">#{i + 1}</span>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-technical">
                      {m.material} • Coût Δv : <span className="font-bold text-cyan-600 dark:text-cyan-400">{m.delta_v_cost} m/s</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-technical font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Score {Math.round(m.score)}
                  </span>
                  <ChevronRight size={15} className="text-gray-400 group-hover:text-cyan-500 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
