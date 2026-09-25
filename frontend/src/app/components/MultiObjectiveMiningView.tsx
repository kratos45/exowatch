"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Pickaxe, Sliders, Box, TrendingUp, DollarSign, Fuel, Shield, Compass } from "lucide-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from "recharts";

const API_URL = "http://127.0.0.1:8000/api";
const STATIC_URL = "http://127.0.0.1:8000/static";

export default function MultiObjectiveMiningView() {
  const [weights, setWeights] = useState({
    w_cost: 0.35,
    w_duration: 0.2,
    w_risk: 0.15,
    w_value: 0.3,
  });

  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [isSimulating3D, setIsSimulating3D] = useState<boolean>(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  const fetchCandidates = async () => {
    try {
      const res = await axios.post(`${API_URL}/mining/multi-objective`, weights);
      setCandidates(res.data);
      if (res.data.length > 0 && !selectedTarget) {
        setSelectedTarget(res.data[0]);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchCandidates();
  }, [weights]);

  const handleSimulate = async () => {
    if (!selectedTarget) return;
    setIsSimulating3D(true);
    try {
      const res = await axios.post(`${API_URL}/simulate-velocity`, {
        name: selectedTarget.name,
        velocity: selectedTarget.velocity || 52000,
      });
      setGifUrl(`${STATIC_URL}/${res.data.gif_path}?t=${new Date().getTime()}`);
    } catch (err) {
      alert("Erreur lors de la simulation.");
    }
    setIsSimulating3D(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-sm h-full">
      {/* Colonne Gauche : Sliders de Pondération & Classement (7/12) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Sliders Multi-Critères */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-600" />
              <h3 className="font-extrabold text-cyan-800 uppercase tracking-wider text-sm">
                Comparateur de Scénarios de Minage (Routage Multi-Objectifs)
              </h3>
            </div>
            <span className="text-[10px] text-gray-500 font-bold">RECALCUL PARETO LIVE</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-1">
            {/* Weight 1: Delta-V Fuel Cost */}
            <div>
              <div className="flex justify-between text-gray-700 mb-1">
                <span className="flex items-center gap-1 font-bold text-cyan-700">
                  <Fuel size={12} /> Économie d'Ergols (ΔV)
                </span>
                <span className="font-bold">{Math.round(weights.w_cost * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.w_cost}
                onChange={(e) => setWeights({ ...weights, w_cost: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Weight 2: Transit Duration */}
            <div>
              <div className="flex justify-between text-gray-700 mb-1">
                <span className="flex items-center gap-1 font-bold text-amber-700">
                  <Compass size={12} /> Rapidité de Transit
                </span>
                <span className="font-bold">{Math.round(weights.w_duration * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.w_duration}
                onChange={(e) => setWeights({ ...weights, w_duration: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-amber-500"
              />
            </div>

            {/* Weight 3: Mission Safety */}
            <div>
              <div className="flex justify-between text-gray-700 mb-1">
                <span className="flex items-center gap-1 font-bold text-green-700">
                  <Shield size={12} /> Sécurité / Stabilité
                </span>
                <span className="font-bold">{Math.round(weights.w_risk * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.w_risk}
                onChange={(e) => setWeights({ ...weights, w_risk: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-green-500"
              />
            </div>

            {/* Weight 4: Ore Value */}
            <div>
              <div className="flex justify-between text-gray-700 mb-1">
                <span className="flex items-center gap-1 font-bold text-purple-700">
                  <DollarSign size={12} /> Richesse en Minerais
                </span>
                <span className="font-bold">{Math.round(weights.w_value * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.w_value}
                onChange={(e) => setWeights({ ...weights, w_value: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Candidates Table */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1 flex flex-col min-h-[340px]">
          <h4 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Pickaxe size={14} className="text-cyan-600" /> Cibles Optimales selon Critères Pondérés
            </span>
            <span className="text-[10px] text-cyan-600 font-bold">Frontière de Pareto Active</span>
          </h4>

          <div className="flex-1 overflow-y-auto border border-cyan-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-cyan-700 text-[10px] uppercase font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">Rang</th>
                  <th className="p-2.5">Astéroïde</th>
                  <th className="p-2.5">Matériau</th>
                  <th className="p-2.5">Coût ΔV</th>
                  <th className="p-2.5">Transit</th>
                  <th className="p-2.5">Score Composite</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => {
                  const isSelected = selectedTarget?.name === c.name;
                  return (
                    <tr
                      key={i}
                      onClick={() => {
                        setSelectedTarget(c);
                        setGifUrl(null);
                      }}
                      className={`border-b border-gray-100 cursor-pointer transition ${
                        isSelected
                          ? "bg-cyan-100/70 text-cyan-950 font-bold"
                          : "hover:bg-cyan-50/50 text-gray-700"
                      }`}
                    >
                      <td className="p-2.5 font-bold text-gray-400">#{i + 1}</td>
                      <td className="p-2.5 font-bold text-cyan-800">{c.name}</td>
                      <td className="p-2.5">{c.material}</td>
                      <td className="p-2.5 font-mono text-cyan-600 font-bold">{c.delta_v_cost} m/s</td>
                      <td className="p-2.5">{c.duration_days} j</td>
                      <td className="p-2.5 font-bold text-green-600 text-sm">{c.composite_score} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Colonne Droite : Inspection Cible & Visualisation 3D (5/12) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {selectedTarget ? (
          <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-4">
            <div className="border-b border-cyan-100 pb-2">
              <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">
                CIBLE DE MINAGE SÉLECTIONNÉE
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 truncate mt-1">{selectedTarget.name}</h3>
              <p className="text-xs text-gray-500">Composition : {selectedTarget.material}</p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">DIAMÈTRE EST.</div>
                <div className="text-base font-bold text-gray-900">{selectedTarget.diameter} km</div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">COÛT DELTA-V</div>
                <div className="text-base font-bold text-cyan-600">{selectedTarget.delta_v_cost} m/s</div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <div className="text-[10px] text-gray-500">TEMPS TRANSIT</div>
                <div className="text-base font-bold text-amber-600">{selectedTarget.duration_days} jours</div>
              </div>
              <div className="bg-green-50 p-2.5 rounded border border-green-200">
                <div className="text-[10px] text-green-700">SCORE COMPOSITE</div>
                <div className="text-base font-bold text-green-700">{selectedTarget.composite_score} pts</div>
              </div>
            </div>

            {/* Breakdown Progress Bars */}
            {selectedTarget.norm_metrics && (
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                    <span>Efficacité Ergols</span>
                    <span className="font-bold">{selectedTarget.norm_metrics.fuel_efficiency}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full rounded-full"
                      style={{ width: `${selectedTarget.norm_metrics.fuel_efficiency}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                    <span>Rapidité de Transit</span>
                    <span className="font-bold">{selectedTarget.norm_metrics.transit_speed}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${selectedTarget.norm_metrics.transit_speed}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                    <span>Valeur Minérale</span>
                    <span className="font-bold">{selectedTarget.norm_metrics.ore_value}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{ width: `${selectedTarget.norm_metrics.ore_value}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3D Interception Simulation Box */}
            <div className="border border-cyan-200 rounded-lg p-3 bg-gray-50 flex flex-col items-center justify-center min-h-[170px] relative">
              {gifUrl ? (
                <img src={gifUrl} alt="Simulation 3D" className="w-full h-36 object-contain rounded" />
              ) : isSimulating3D ? (
                <div className="text-cyan-600 font-bold animate-pulse text-xs">Calcul de trajectoire 3D...</div>
              ) : (
                <div className="text-center text-gray-500 text-xs">
                  <Box className="w-8 h-8 mx-auto mb-1 text-gray-400 opacity-40" />
                  Cliquez ci-dessous pour simuler l'interception orbitale.
                </div>
              )}
              <button
                onClick={handleSimulate}
                disabled={isSimulating3D}
                className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs uppercase rounded transition shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                <Box size={14} /> {gifUrl ? "Re-simuler Vitesse 3D" : "Lancer Simulation Vitesse 3D"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-cyan-100 rounded-xl bg-white p-5 text-center text-gray-400 text-xs">
            Sélectionnez une cible dans la liste.
          </div>
        )}
      </div>
    </div>
  );
}
