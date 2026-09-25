"use client";

import React, { useEffect, useState } from "react";
import {
  Crosshair,
  Pickaxe,
  Share2,
  AlertTriangle,
  Globe,
  Bot,
  Clock,
  Compass,
  Award,
  Box,
  MessageSquare,
  Terminal,
  Sparkles,
  Zap,
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

// Custom Component Views
import LivingSolarSystem3D from "./components/LivingSolarSystem3D";
import ThreatTimelineView from "./components/ThreatTimelineView";
import ImpactSimulatorView from "./components/ImpactSimulatorView";
import MultiStepAgentView from "./components/MultiStepAgentView";
import GraphAnalyticsView from "./components/GraphAnalyticsView";
import MultiObjectiveMiningView from "./components/MultiObjectiveMiningView";
import ThreatHunterGamification from "./components/ThreatHunterGamification";
import MissionControlBar from "./components/MissionControlBar";

const API_URL = "http://127.0.0.1:8000/api";
const STATIC_URL = "http://127.0.0.1:8000/static";

// --- Global Chat Component ---
function GlobalChat({ selectedTarget }: { selectedTarget?: string }) {
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [isChatting, setIsChatting] = useState(false);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput) return;
    setIsChatting(true);
    try {
      const res = await axios.post(`${API_URL}/chat`, { question: chatInput });
      setChatResponse(res.data);
    } catch (err) {}
    setIsChatting(false);
  };

  return (
    <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 h-full flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-cyan-100 pb-2 mb-3">
        <h2 className="text-cyan-700 font-extrabold uppercase text-xs flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-cyan-600" /> Uplink Copilote IA
        </h2>
        <span className="text-[10px] bg-cyan-50 border border-cyan-300 text-cyan-700 px-2 py-0.5 rounded font-bold">
          TEXT-TO-CYPHER
        </span>
      </div>

      <div className="flex-1 overflow-y-auto mb-3 space-y-3 text-xs pr-1">
        <div className="bg-cyan-50/50 border border-cyan-200 p-2.5 rounded-lg text-cyan-900 text-[11px] leading-relaxed">
          Posez vos requêtes en langage naturel. Le modèle génère les requêtes Cypher pour interroger le graphe Neo4j.
        </div>

        {selectedTarget && (
          <div className="text-[10px] bg-gray-50 border border-gray-200 p-2 rounded text-gray-600 flex items-center gap-1">
            <span className="text-cyan-600 font-bold">Cible sélectionnée :</span> {selectedTarget}
          </div>
        )}

        <AnimatePresence>
          {chatResponse && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="bg-gray-50 border border-cyan-300 p-2 rounded text-cyan-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-700 mb-1">
                  <Terminal className="w-3 h-3" /> REQUÊTE CYPHER GÉNÉRÉE :
                </div>
                <code className="break-all font-mono text-[10px] bg-white p-1 rounded border block border-cyan-200">
                  {chatResponse.query}
                </code>
              </div>

              {chatResponse.summary && (
                <div className="bg-white border border-cyan-200 p-3 rounded-lg text-gray-800 text-xs leading-relaxed whitespace-pre-wrap shadow-sm">
                  {chatResponse.summary}
                </div>
              )}

              {chatResponse.data?.length > 0 ? (
                <details className="bg-gray-50 border border-gray-200 rounded p-2 text-[10px]">
                  <summary className="cursor-pointer font-bold text-cyan-700 uppercase">
                    Données Brutes ({chatResponse.data.length} résultats)
                  </summary>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {chatResponse.data.slice(0, 5).map((row: any, i: number) => (
                      <div key={i} className="border-b border-gray-200 pb-1 text-gray-700 font-mono">
                        {JSON.stringify(row)}
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <div className="text-gray-400 text-[10px] italic">0 enregistrement trouvé.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isChatting && (
          <div className="text-cyan-600 font-bold animate-pulse text-xs flex items-center gap-1.5">
            <Sparkles size={13} /> Analyse et interrogation Neo4j...
          </div>
        )}
      </div>

      <form onSubmit={handleChatSubmit} className="mt-auto">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ex: Donne-moi les astéroïdes contenant du fer..."
          disabled={isChatting}
          className="w-full bg-white border-2 border-cyan-300 rounded-lg text-gray-900 p-2.5 text-xs outline-none focus:border-cyan-500 shadow-sm disabled:opacity-50"
        />
      </form>
    </div>
  );
}

// --- 3D Shape & Velocity Viewer Box ---
function Viewer3D({
  targetName,
  material,
  velocity,
  simType = "shape",
}: {
  targetName: string;
  material: string;
  velocity?: string;
  simType?: "shape" | "velocity";
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  useEffect(() => {
    setGifUrl(null);
  }, [targetName, simType]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let url = `${API_URL}/generate-3d`;
      let payload: any = { name: targetName, material: material };
      if (simType === "velocity") {
        url = `${API_URL}/simulate-velocity`;
        payload = { name: targetName, velocity: velocity || "54000" };
      }
      const res = await axios.post(url, payload);
      setGifUrl(`${STATIC_URL}/${res.data.gif_path}?t=${new Date().getTime()}`);
    } catch (err) {
      alert("Erreur lors de la génération 3D.");
    }
    setIsGenerating(false);
  };

  return (
    <div className="bg-white border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-lg p-2 h-44 flex items-center justify-center relative group">
      {gifUrl ? (
        <img src={gifUrl} alt="3D View" className="w-full h-full object-contain" />
      ) : isGenerating ? (
        <div className="text-cyan-600 font-bold animate-pulse text-xs text-center">
          Génération 3D en cours...
        </div>
      ) : (
        <div className="text-gray-400 text-xs text-center">
          <Box className="w-7 h-7 mx-auto mb-1 opacity-30" /> En attente de rendu...
        </div>
      )}
      <div className="absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[10px] font-bold uppercase transition shadow"
        >
          {gifUrl ? "Re-générer" : simType === "shape" ? "Modèle 3D Shap-E" : "Simuler Vitesse"}
        </button>
      </div>
    </div>
  );
}

// --- Main Application ---
export default function Home() {
  const [activeTab, setActiveTab] = useState("solar");
  const [solarData, setSolarData] = useState<{ planets: any[]; asteroids: any[] }>({ planets: [], asteroids: [] });
  const [selectedEntity, setSelectedEntity] = useState<string>("99942 Apophis (2004 MN4)");

  // Load Solar System Kepler data once on load
  useEffect(() => {
    axios.get(`${API_URL}/solar-system`).then((res) => {
      setSolarData(res.data);
    });
  }, []);

  return (
    <div className="flex flex-col h-[86vh] gap-3">
      {/* Top Live Mission Control DEFCON & Copilot Alert Bar */}
      <MissionControlBar activeTab={activeTab} selectedEntityName={selectedEntity} />

      {/* Main Workspace Area (Nav Tabs + View Panels + Sidebar) */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Main Column (3/4) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Navigation Bar */}
          <div className="flex gap-2 border-b-2 border-cyan-200 pb-2 mb-3 overflow-x-auto custom-scrollbar">
            <TabButton
              id="solar"
              active={activeTab}
              icon={<Compass size={15} />}
              label="🌌 Cockpit 3D Solaire"
              onClick={setActiveTab}
            />
            <TabButton
              id="timeline"
              active={activeTab}
              icon={<Clock size={15} />}
              label="⏱️ Timeline Menace"
              onClick={setActiveTab}
            />
            <TabButton
              id="impact"
              active={activeTab}
              icon={<AlertTriangle size={15} />}
              label="💥 Impact Simulator"
              onClick={setActiveTab}
            />
            <TabButton
              id="agent"
              active={activeTab}
              icon={<Bot size={15} />}
              label="🤖 Agent IA & Rapports"
              onClick={setActiveTab}
            />
            <TabButton
              id="graph"
              active={activeTab}
              icon={<Share2 size={15} />}
              label="📊 Graph Analytics"
              onClick={setActiveTab}
            />
            <TabButton
              id="mining"
              active={activeTab}
              icon={<Pickaxe size={15} />}
              label="💰 Minage Multi-Objectifs"
              onClick={setActiveTab}
            />
            <TabButton
              id="gamification"
              active={activeTab}
              icon={<Award size={15} />}
              label="🎯 Chasseur de Menaces"
              onClick={setActiveTab}
            />
            <TabButton
              id="hud"
              active={activeTab}
              icon={<Crosshair size={15} />}
              label="🛰️ HUD Radar"
              onClick={setActiveTab}
            />
            <TabButton
              id="exo"
              active={activeTab}
              icon={<Globe size={15} />}
              label="🪐 Exoplanètes"
              onClick={setActiveTab}
            />
          </div>

          {/* Active View Container */}
          <div className="flex-1 overflow-y-auto relative pr-1 custom-scrollbar">
            {activeTab === "solar" && (
              <LivingSolarSystem3D
                data={solarData}
                onSelectObject={(obj) => setSelectedEntity(obj.name)}
                selectedObjectName={selectedEntity}
              />
            )}
            {activeTab === "timeline" && (
              <ThreatTimelineView onSelectAsteroid={(name) => setSelectedEntity(name)} />
            )}
            {activeTab === "impact" && <ImpactSimulatorView selectedTarget={selectedEntity} />}
            {activeTab === "agent" && <MultiStepAgentView />}
            {activeTab === "graph" && <GraphAnalyticsView />}
            {activeTab === "mining" && <MultiObjectiveMiningView />}
            {activeTab === "gamification" && <ThreatHunterGamification />}
            {activeTab === "hud" && (
              <HudView onSelect={(name) => setSelectedEntity(name)} selectedTarget={selectedEntity} />
            )}
            {activeTab === "exo" && <ExoplanetsView />}
          </div>
        </div>

        {/* Right Sidebar: Global Chat & Copilot Uplink (1/4) */}
        <div className="w-[360px] flex-shrink-0 hidden lg:block">
          <GlobalChat selectedTarget={selectedEntity} />
        </div>
      </div>
    </div>
  );
}

function TabButton({ id, active, icon, label, onClick }: any) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-lg transition-all text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
        isActive
          ? "border-2 border-cyan-400 bg-white text-cyan-700 shadow-[0_0_15px_rgba(0,255,255,0.4)] scale-105 z-10"
          : "border-gray-200 bg-white text-gray-500 hover:border-cyan-300 hover:text-cyan-600 hover:shadow-sm"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// --- HUD Radar Component ---
function HudView({ onSelect, selectedTarget }: { onSelect: (name: string) => void; selectedTarget?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/asteroids`).then((res) => {
      setItems(res.data);
      if (res.data.length > 0) {
        const found = res.data.find((x: any) => x.name === selectedTarget) || res.data[0];
        setSelected(found);
      }
      setLoading(false);
    });
  }, [selectedTarget]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-sm h-full">
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1 flex flex-col relative overflow-hidden">
          <div className="text-xs font-bold text-cyan-800 uppercase tracking-wider mb-3 border-b border-cyan-100 pb-2 flex items-center justify-between">
            <span>Catalogue Objets Géocroiseurs</span>
            <span className="text-[10px] text-gray-400 font-bold">{items.length} NEOs</span>
          </div>

          {loading ? (
            <div className="text-cyan-600 font-bold animate-pulse text-xs">Scan radar en cours...</div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelected(item);
                    onSelect(item.name);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selected?.name === item.name
                      ? "border-cyan-500 bg-cyan-50 text-cyan-900 font-bold shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                      : "border-gray-200 bg-white hover:border-cyan-300 text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold truncate text-xs">{item.name}</span>
                    {item.pha && (
                      <span className="text-[9px] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded font-bold animate-pulse">
                        PHA
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                    <span>{item.material || "Silicates"}</span>
                    <span>{item.d_max} km</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selected && (
          <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-6 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-cyan-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
                  FICHE TÉLÉMÉTRIQUE COMPLÈTE
                </span>
                <h2 className="text-2xl font-black text-gray-900 mt-1">{selected.name}</h2>
              </div>
              {/* Scientific Credibility Badge */}
              <div className="bg-cyan-50 border border-cyan-300 p-2 rounded-lg text-right">
                <div className="text-[10px] text-gray-500 font-bold">INDICE DE CONFIANCE IA</div>
                <div className="text-base font-black text-cyan-700">{selected.confidence_score || 88}% Fiabilité</div>
                <div className="text-[9px] text-gray-500 mt-0.5 truncate max-w-[200px]">
                  {selected.evidence_basis || "NEOWISE IR + Spectroscopie"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 text-[10px]">DIAMÈTRE</div>
                <div className="text-lg font-bold text-cyan-700">{selected.d_max} km</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 text-[10px]">VITESSE RELATIVE</div>
                <div className="text-lg font-bold text-cyan-700">{Math.round(selected.vel)} km/h</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-gray-500 text-[10px]">MATÉRIAU</div>
                <div className="text-base font-bold text-gray-800 truncate">{selected.material || "INCONNU"}</div>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  selected.impact_prob > 5 ? "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="text-gray-500 text-[10px]">PROB. IMPACT</div>
                <div className="text-lg font-bold text-green-600">{selected.impact_prob || 0}%</div>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <h3 className="text-cyan-800 font-bold text-xs uppercase mb-2">Analyse Qualitative du Risque</h3>
                <p className="text-gray-700 leading-relaxed text-[12px]">
                  {selected.risk || "Orbite nominale sans anomalie cinétique détectée."}
                </p>
                <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500 space-y-1">
                  <div>
                    Demi-grand axe : <span className="font-bold text-gray-700">{selected.semi_major_axis || "N/A"} UA</span>
                  </div>
                  <div>
                    Excentricité : <span className="font-bold text-gray-700">{selected.eccentricity || "N/A"}</span>
                  </div>
                  <div>
                    Période orbitale : <span className="font-bold text-gray-700">{selected.orbital_period ? Math.round(selected.orbital_period) : "N/A"} jours</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-1/2">
                <h3 className="text-cyan-800 font-bold text-xs uppercase mb-2">Visualiseur 3D Synthétique</h3>
                <Viewer3D targetName={selected.name} material={selected.material || "rock"} simType="shape" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Exoplanets View ---
function ExoplanetsView() {
  const [data, setData] = useState([]);
  useEffect(() => {
    axios.get(`${API_URL}/exoplanets`).then((res) => setData(res.data));
  }, []);

  return (
    <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white h-full p-6 flex flex-col font-mono text-sm">
      <div className="flex items-center justify-between mb-4 border-b border-cyan-100 pb-2">
        <h3 className="font-bold text-cyan-800 uppercase text-xs">Catalogue Exoplanètes Validées (NASA Exoplanet Archive)</h3>
        <span className="text-xs bg-cyan-50 border border-cyan-300 text-cyan-700 px-3 py-1 rounded font-bold">
          {data.length} Exoplanètes
        </span>
      </div>

      <div className="flex-1 overflow-auto border border-cyan-100 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-cyan-700 font-bold text-[10px] uppercase sticky top-0">
            <tr>
              <th className="p-3">Nom Planète</th>
              <th className="p-3">Étoile Hôte</th>
              <th className="p-3">Rayon (Terre)</th>
              <th className="p-3">Masse (Terre)</th>
              <th className="p-3">Période (Jours)</th>
              <th className="p-3">Score Atypicité ML</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-cyan-50/50 text-gray-800">
                <td className="p-3 font-bold text-cyan-800">{row.name}</td>
                <td className="p-3">{row.hostname}</td>
                <td className="p-3">{row.pl_rade || "-"}</td>
                <td className="p-3">{row.pl_bmasse || "-"}</td>
                <td className="p-3">{row.pl_orbper ? Math.round(row.pl_orbper) : "-"}</td>
                <td className="p-3">
                  <span className="bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-bold text-[10px]">
                    {row.anomaly_score_ml ? (row.anomaly_score_ml * 100).toFixed(1) : 0}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
