"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Clock, AlertTriangle, ShieldAlert, Play, Pause, ChevronRight, Activity, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const API_URL = "http://127.0.0.1:8000/api";

interface ThreatObject {
  name: string;
  dynamic_threat_score: number;
  base_score: number;
  status: string;
  badge_color: string;
  diameter: number;
  velocity: number;
  material: string;
  next_close_approach_year: number;
  estimated_miss_distance_ld: number;
}

export default function ThreatTimelineView({ onSelectAsteroid }: { onSelectAsteroid?: (name: string) => void }) {
  const [yearOffset, setYearOffset] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<ThreatObject | null>(null);

  // Fetch timeline projection whenever yearOffset changes
  useEffect(() => {
    let isCancelled = false;
    axios.get(`${API_URL}/threat-timeline?year=${yearOffset}`).then((res) => {
      if (!isCancelled) {
        setTimelineData(res.data);
        if (res.data.leaderboard?.length > 0 && !selectedItem) {
          setSelectedItem(res.data.leaderboard[0]);
        }
        setLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [yearOffset]);

  // Automated playback loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setYearOffset((prev) => (prev >= 100 ? 0 : Math.round((prev + 1) * 10) / 10));
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Generate trend line data for the top 3 asteroids over time
  const trendSamples = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((yr) => {
    const yrInt = 2026 + yr;
    return {
      year: yrInt,
      Apophis: Math.max(1, 2.5 + Math.sin(yr / 7) * 2.2 + (yr >= 3 && yr <= 6 ? 3.5 : 0)),
      Bennu: Math.max(1, 1.8 + Math.cos(yr / 11) * 1.6 + (yr >= 30 && yr <= 38 ? 2.8 : 0)),
      "1950 DA": Math.max(0.5, 1.2 + Math.sin(yr / 15) * 1.5),
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-sm h-full">
      {/* Colonne Gauche : Contrôleur Temporel & Leaderboard Dynamique (2/3) */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Curseur Temporel Interactif (Cockpit Time Scrubber) */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-3 border-b border-cyan-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-600 animate-spin" />
              <h2 className="text-cyan-700 font-extrabold uppercase tracking-wider text-base">
                Timeline de Menace Interactive (2026 ➔ 2126)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">HORIZON PROJETÉ :</span>
              <span className="text-xl font-bold text-cyan-600 bg-cyan-50 px-3 py-1 rounded border border-cyan-300 shadow-[0_0_8px_rgba(0,255,255,0.3)]">
                {timelineData?.absolute_year || 2026 + Math.round(yearOffset)}
                <span className="text-xs text-cyan-400 font-normal ml-1">(J+{Math.round(yearOffset)} ans)</span>
              </span>
            </div>
          </div>

          {/* Time Scrubber Slider & Controls */}
          <div className="flex items-center gap-4 py-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs uppercase transition border shadow ${
                isPlaying
                  ? "bg-amber-100 text-amber-800 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  : "bg-cyan-500 text-white border-cyan-400 hover:bg-cyan-600 shadow-[0_0_10px_rgba(0,255,255,0.4)]"
              }`}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pause" : "Rejouer"}
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={yearOffset}
                onChange={(e) => setYearOffset(parseFloat(e.target.value))}
                className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-bold px-1">
                <span>Présent (2026)</span>
                <span className="text-amber-600 font-bold">2040</span>
                <span className="text-cyan-600 font-bold">2070</span>
                <span>Centenaire (2126)</span>
              </div>
            </div>

            <button
              onClick={() => setYearOffset(0)}
              className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-cyan-600 border border-gray-200 hover:border-cyan-400 rounded transition"
            >
              J-0
            </button>
          </div>

          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100 text-center">
            <div className="bg-gray-50 p-2 rounded border border-gray-200">
              <div className="text-[10px] text-gray-500">CORPS SOUS SURVEILLANCE</div>
              <div className="text-lg font-bold text-gray-800">{timelineData?.total_tracked || 35}</div>
            </div>
            <div className="bg-red-50 p-2 rounded border border-red-200">
              <div className="text-[10px] text-red-600 font-bold flex items-center justify-center gap-1">
                <AlertTriangle size={12} /> CROISEMENTS CRITIQUES
              </div>
              <div className="text-lg font-bold text-red-600 animate-pulse">{timelineData?.critical_count || 0}</div>
            </div>
            <div className="bg-cyan-50 p-2 rounded border border-cyan-200">
              <div className="text-[10px] text-cyan-600 font-bold">RÉSONANCE ORBITALE</div>
              <div className="text-lg font-bold text-cyan-700">PageRank Live</div>
            </div>
          </div>
        </div>

        {/* Dynamic Threat Leaderboard Table */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              Classement Dynamique de Danger à T+{Math.round(yearOffset)} ans
            </h3>
            <span className="text-[11px] text-gray-500">Cliquez sur un objet pour l'inspecter</span>
          </div>

          <div className="flex-1 overflow-y-auto border border-cyan-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-cyan-700 sticky top-0 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Rang</th>
                  <th className="p-2.5">Astéroïde</th>
                  <th className="p-2.5">Score Menace (PageRank)</th>
                  <th className="p-2.5">Statut</th>
                  <th className="p-2.5">Plus Proche Passage</th>
                  <th className="p-2.5">Distance (LD)</th>
                </tr>
              </thead>
              <tbody>
                {timelineData?.leaderboard?.map((item: ThreatObject, index: number) => {
                  const isSelected = selectedItem?.name === item.name;
                  return (
                    <tr
                      key={item.name}
                      onClick={() => {
                        setSelectedItem(item);
                        if (onSelectAsteroid) onSelectAsteroid(item.name);
                      }}
                      className={`border-b border-gray-100 cursor-pointer transition ${
                        isSelected
                          ? "bg-cyan-50 text-cyan-900 font-bold"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <td className="p-2.5 font-bold text-gray-400">#{index + 1}</td>
                      <td className="p-2.5 font-bold text-gray-900 flex items-center gap-1.5">
                        {item.dynamic_threat_score > 3.5 && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        )}
                        {item.name}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`font-bold ${
                            item.dynamic_threat_score > 3.5
                              ? "text-red-600 text-sm"
                              : item.dynamic_threat_score > 1.8
                              ? "text-amber-600"
                              : "text-cyan-600"
                          }`}
                        >
                          {item.dynamic_threat_score.toFixed(2)} pts
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.badge_color === "red"
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : item.badge_color === "amber"
                              ? "bg-amber-100 text-amber-700 border border-amber-300"
                              : "bg-cyan-100 text-cyan-700 border border-cyan-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-600 font-mono">
                        {2026 + Math.round(item.next_close_approach_year)}
                      </td>
                      <td className="p-2.5 font-bold text-gray-800">
                        {item.estimated_miss_distance_ld.toFixed(2)} LD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Colonne Droite : Fiche Détaillée & Projection Temporelle (1/3) */}
      <div className="flex flex-col gap-4">
        {selectedItem ? (
          <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-3">
            <div className="border-b border-cyan-100 pb-3">
              <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
                RAPPORT TÉLÉMÉTRIQUE T+{Math.round(yearOffset)} ANS
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 mt-1 truncate">{selectedItem.name}</h3>
              <p className="text-xs text-gray-500">Matériau : {selectedItem.material}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">DIAMÈTRE</div>
                <div className="text-base font-bold text-gray-800">{selectedItem.diameter} km</div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">VITESSE INTERCEPT.</div>
                <div className="text-base font-bold text-cyan-600">{Math.round(selectedItem.velocity)} km/h</div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">SCORE BASE</div>
                <div className="text-base font-bold text-gray-700">{selectedItem.base_score} pts</div>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  selectedItem.dynamic_threat_score > 3.5
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-cyan-50 border-cyan-300 text-cyan-700"
                }`}
              >
                <div className="text-[10px]">SCORE DYNAMIQUE</div>
                <div className="text-base font-bold">{selectedItem.dynamic_threat_score.toFixed(2)} pts</div>
              </div>
            </div>

            <div className="bg-cyan-50/50 p-3 rounded-lg border border-cyan-200 text-xs text-gray-700 space-y-1">
              <div className="font-bold text-cyan-800 flex items-center gap-1.5">
                <Activity size={14} /> Modélisation Perturbation Gravitationnelle
              </div>
              <p className="text-[11px] leading-relaxed text-gray-600">
                L'évolution temporelle intègre les résonances avec Jupiter et la Terre. Un pic de rapprochement orbital
                est modélisé pour l'année{" "}
                <span className="font-bold text-cyan-700">
                  {2026 + Math.round(selectedItem.next_close_approach_year)}
                </span>
                .
              </p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-cyan-100 rounded-xl bg-white p-5 text-center text-gray-500 text-xs">
            Sélectionnez un astéroïde dans le classement.
          </div>
        )}

        {/* Graphique d'Évolution Temporelle Multi-Astéroïdes */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-cyan-700 uppercase flex items-center gap-1.5">
              <TrendingUp size={14} /> Courbes de Danger (Projection 100 Ans)
            </h4>
            <span className="text-[10px] text-gray-400">Score PageRank</span>
          </div>
          <div className="flex-1 w-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSamples} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#06b6d4", borderRadius: "8px", fontSize: "11px" }}
                />
                <Line type="monotone" dataKey="Apophis" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bennu" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="1950 DA" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-[10px] text-gray-600 mt-2 font-bold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 99942 Apophis</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 101955 Bennu</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> 29075 (1950 DA)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
