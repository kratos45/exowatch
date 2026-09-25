"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { Share2, GitBranch, AlertCircle, Rocket, Eye, Database } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });
const API_URL = "http://127.0.0.1:8000/api";

export default function GraphAnalyticsView() {
  const [subTab, setSubTab] = useState<"link" | "anomalies" | "network">("link");
  const [linkPredictions, setLinkPredictions] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/graph/link-prediction`),
      axios.get(`${API_URL}/graph/anomalies`),
      axios.get(`${API_URL}/graph`),
    ]).then(([linkRes, anomRes, graphRes]) => {
      setLinkPredictions(linkRes.data);
      setAnomalies(anomRes.data);
      setGraphData(graphRes.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col h-full font-mono text-sm gap-4">
      {/* Sub Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-cyan-100 pb-2">
        <button
          onClick={() => setSubTab("link")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
            subTab === "link"
              ? "bg-cyan-50 border-cyan-400 text-cyan-700 shadow-[0_0_10px_rgba(0,255,255,0.2)]"
              : "bg-white border-gray-200 text-gray-600 hover:border-cyan-300"
          }`}
        >
          <Rocket size={14} className="text-cyan-600" />
          Prédiction de Liens (Missions Futures)
        </button>

        <button
          onClick={() => setSubTab("anomalies")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
            subTab === "anomalies"
              ? "bg-amber-50 border-amber-400 text-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
          }`}
        >
          <AlertCircle size={14} className="text-amber-600" />
          Anomalies Structurelles du Graphe
        </button>

        <button
          onClick={() => setSubTab("network")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
            subTab === "network"
              ? "bg-purple-50 border-purple-400 text-purple-700 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
              : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
          }`}
        >
          <Share2 size={14} className="text-purple-600" />
          Explorateur Topologique (ForceGraph)
        </button>
      </div>

      {/* Tab 1: Link Prediction Table */}
      {subTab === "link" && (
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-cyan-100 pb-2">
            <div>
              <h3 className="font-extrabold text-cyan-800 uppercase tracking-wider text-sm flex items-center gap-2">
                <Rocket className="w-4 h-4 text-cyan-600" /> Prédiction de Nouvelles Relations (Link Prediction GDS)
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Algorithmes de similarité de Jaccard & Resource Allocation reliant les missions passées (OSIRIS-REx, Hayabusa2) aux nouvelles cibles optimales.
              </p>
            </div>
            <span className="text-xs bg-cyan-50 border border-cyan-300 text-cyan-700 px-3 py-1 rounded font-bold">
              {linkPredictions.length} Cibles Recommandées
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border border-cyan-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-cyan-700 text-[10px] uppercase font-bold sticky top-0">
                <tr>
                  <th className="p-3">Mission de Référence</th>
                  <th className="p-3">Agence</th>
                  <th className="p-3">Astéroïde Cible Prédit</th>
                  <th className="p-3">Matériau Analogue</th>
                  <th className="p-3">Diamètre</th>
                  <th className="p-3">Delta-V Estimé</th>
                  <th className="p-3">Indice de Confiance</th>
                </tr>
              </thead>
              <tbody>
                {linkPredictions.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-cyan-50/50 text-gray-800">
                    <td className="p-3 font-bold text-gray-900">{row.past_reference_mission}</td>
                    <td className="p-3">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {row.agency}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-cyan-700">{row.candidate_asteroid}</td>
                    <td className="p-3">{row.material}</td>
                    <td className="p-3">{row.diameter_km} km</td>
                    <td className="p-3 text-cyan-600 font-bold">{row.estimated_delta_v} m/s</td>
                    <td className="p-3">
                      <span className="bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded font-bold text-[10px]">
                        {row.link_prediction_confidence}% Compatibilité
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Graph Anomalies Table */}
      {subTab === "anomalies" && (
        <div className="border-2 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)] rounded-xl bg-white p-5 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-amber-100 pb-2">
            <div>
              <h3 className="font-extrabold text-amber-800 uppercase tracking-wider text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Détection d'Anomalies Structurelles dans le Graphe
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Isolation de nœuds topologiquement excentriques (excentricité orbitale &gt; 0.65, orbites inclinées ou interstellaires).
              </p>
            </div>
            <span className="text-xs bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1 rounded font-bold">
              {anomalies.length} Objets Atypiques
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border border-amber-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-amber-800 text-[10px] uppercase font-bold sticky top-0">
                <tr>
                  <th className="p-3">Astéroïde</th>
                  <th className="p-3">Matériau</th>
                  <th className="p-3">Demi-Grand Axe (UA)</th>
                  <th className="p-3">Excentricité (e)</th>
                  <th className="p-3">Période (Jours)</th>
                  <th className="p-3">Classification Anomalie</th>
                  <th className="p-3">Score Structurel</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-amber-50/50 text-gray-800">
                    <td className="p-3 font-bold text-amber-900">{row.name}</td>
                    <td className="p-3">{row.material}</td>
                    <td className="p-3 font-mono">{row.semi_major_axis ? row.semi_major_axis.toFixed(3) : "-"}</td>
                    <td className="p-3 font-mono font-bold text-amber-700">{row.eccentricity ? row.eccentricity.toFixed(3) : "-"}</td>
                    <td className="p-3">{row.orbital_period ? Math.round(row.orbital_period) : "-"} j</td>
                    <td className="p-3 text-[11px] text-gray-600">{row.anomaly_type}</td>
                    <td className="p-3">
                      <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded font-bold text-[10px]">
                        {row.structural_anomaly_score}% Atypique
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Interactive ForceGraph Network */}
      {subTab === "network" && (
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white h-full relative overflow-hidden">
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md p-2.5 rounded-lg border border-cyan-200 shadow z-10 text-[11px] text-gray-700 space-y-1">
            <div className="font-bold text-cyan-800 uppercase text-xs mb-1">Légende des Nœuds Neo4j</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span> Planète (Terre)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]"></span> Mission (OSIRIS-REx, Hayabusa2)</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]"></span> Télescope Spatial</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></span> Route Delta-V</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span> Menace Sentry</div>
          </div>

          <ForceGraph2D
            graphData={graphData}
            nodeLabel="name"
            nodeColor={(node: any) =>
              node.label === "Star"
                ? "#eab308"
                : node.label === "Planet"
                ? "#06b6d4"
                : node.label === "Telescope"
                ? "#8b5cf6"
                : node.label === "SpaceStation"
                ? "#a855f7"
                : node.label === "Mission"
                ? "#ec4899"
                : node.source_cluster
                ? node.source_cluster.includes("Fer")
                  ? "#94a3b8"
                  : node.source_cluster.includes("Silicate")
                  ? "#b45309"
                  : node.source_cluster.includes("Glace")
                  ? "#38bdf8"
                  : "#ef4444"
                : "#ef4444"
            }
            linkColor={(link: any) =>
              link.relation === "THREATENS"
                ? "#ef4444"
                : link.relation === "REACHABLE_WITH_DELTAV"
                ? "#22c55e"
                : "#cbd5e1"
            }
            backgroundColor="#ffffff"
            linkDirectionalArrowLength={3.5}
          />
        </div>
      )}
    </div>
  );
}
