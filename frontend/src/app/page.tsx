"use client";

import { useEffect, useState } from "react";
import { Crosshair, Pickaxe, Database, Radio, MessageSquare, Terminal, Globe, Share2, AlertTriangle, Box } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, BarChart, Bar } from 'recharts';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const API_URL = "http://127.0.0.1:8000/api";
const STATIC_URL = "http://127.0.0.1:8000/static";

// --- Global Chat Component ---
function GlobalChat() {
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
    <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent opacity-30"></div>
      <h2 className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] font-bold mb-4 flex items-center gap-2 border-b border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] pb-2"><MessageSquare className="w-4 h-4" /> UPLINK GLOBALE (IA)</h2>
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 text-xs pr-2">
        <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-3 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">Posez vos questions sur les astéroïdes, les exoplanètes ou le minage spatial.</div>
        <AnimatePresence>
          {chatResponse && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="bg-white border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.2)] border border-cyan-300 shadow-[0_0_10px_rgba(0,255,255,0.3)] p-2 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">
                <div className="flex items-center gap-2 text-[10px] text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] mb-1"><Terminal className="w-3 h-3" /> CYPHER:</div>
                <code>{chatResponse.query}</code>
              </div>
              {chatResponse.summary && (
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-3 text-gray-800 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {chatResponse.summary}
                </div>
              )}
              {chatResponse.data?.length > 0 ? (
                <details className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
                  <summary className="p-2 cursor-pointer text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] text-[10px] uppercase font-bold hover:bg-gray-100">Afficher les Données Brutes</summary>
                  <div className="p-2 max-h-[300px] overflow-y-auto">
                    {chatResponse.data.map((row: any, i: number) => (
                      <div key={i} className="mb-2 pb-2 border-b border-gray-100 last:border-0">
                        {Object.entries(row).map(([k, v]) => (
                          <div key={k} className="flex flex-col"><span className="text-gray-600">{k}:</span> <span className="text-gray-700 break-words">{JSON.stringify(v)}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              ) : <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-2 text-gray-500">0 RÉSULTATS</div>}
            </motion.div>
          )}
        </AnimatePresence>
        {isChatting && <div className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] animate-pulse flex items-center gap-2">Processing...</div>}
      </div>
      <form onSubmit={handleChatSubmit} className="mt-auto">
        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Demander à l'IA..." disabled={isChatting} className="w-full bg-white border border-cyan-300 shadow-[0_0_10px_rgba(0,255,255,0.3)] text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] p-3 outline-none focus:border-cyan-400 transition-colors disabled:opacity-50" />
      </form>
    </div>
  );
}

// --- Simulation Component ---
function Viewer3D({ targetName, material, velocity, simType = "shape" }: { targetName: string, material: string, velocity?: string, simType?: "shape"|"velocity" }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  useEffect(() => { setGifUrl(null); }, [targetName, simType]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let url = `${API_URL}/generate-3d`;
      let payload:any = { name: targetName, material: material };
      if (simType === "velocity") {
        url = `${API_URL}/simulate-velocity`;
        payload = { name: targetName, velocity: velocity || "50000" };
      }
      const res = await axios.post(url, payload);
      setGifUrl(`${STATIC_URL}/${res.data.gif_path}?t=${new Date().getTime()}`);
    } catch (err) { alert("Erreur génération simulation."); }
    setIsGenerating(false);
  };

  return (
    <div className="bg-white border-2 border-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.2)] rounded-lg p-2 h-48 flex items-center justify-center relative group">
      {gifUrl ? <img src={gifUrl} className="w-full h-full object-cover" /> : isGenerating ? <div className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] animate-pulse text-xs">Génération en cours...</div> : <div className="text-gray-600 text-xs"><Box className="w-8 h-8 mx-auto mb-2 opacity-20"/> En attente...</div>}
      <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 border border-cyan-500 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] hover:bg-cyan-50 hover:shadow-[0_0_15px_rgba(0,255,255,0.4)] text-[10px] uppercase font-bold">{gifUrl ? "Re-générer" : (simType === "shape" ? "Modèle 3D" : "Simuler Vitesse")}</button>
      </div>
    </div>
  );
}

// --- Main App ---
export default function Home() {
  const [activeTab, setActiveTab] = useState("hud");

  return (
    <div className="flex h-[85vh] gap-4">
      {/* Colonne Principale de Navigation (3/4) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 border-b border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] pb-2 mb-4 overflow-x-auto">
          <TabButton id="hud" active={activeTab} icon={<Crosshair size={16}/>} label="HUD Radar" onClick={setActiveTab} />
          <TabButton id="graph" active={activeTab} icon={<Share2 size={16}/>} label="Graphe Spatial" onClick={setActiveTab} />
          <TabButton id="exo" active={activeTab} icon={<Globe size={16}/>} label="Exoplanètes" onClick={setActiveTab} />
          <TabButton id="mining" active={activeTab} icon={<Pickaxe size={16}/>} label="Minage" onClick={setActiveTab} />
          <TabButton id="impact" active={activeTab} icon={<AlertTriangle size={16}/>} label="Impacts" onClick={setActiveTab} />
        </div>
        <div className="flex-1 overflow-y-auto relative pr-2 custom-scrollbar">
          {activeTab === "hud" && <HudView />}
          {activeTab === "graph" && <GraphView />}
          {activeTab === "exo" && <ExoplanetsView />}
          {activeTab === "mining" && <MiningView />}
          {activeTab === "impact" && <ImpactView />}
        </div>
      </div>
      {/* Sidebar Chat (1/4) */}
      <div className="w-[400px] flex-shrink-0 hidden lg:block">
        <GlobalChat />
      </div>
    </div>
  );
}

function TabButton({ id, active, icon, label, onClick }: any) {
  return (
    <button onClick={() => onClick(id)} className={`flex items-center gap-2 px-4 py-2 border transition-colors text-xs font-bold uppercase tracking-wider whitespace-nowrap ${active === id ? "border-2 border-cyan-400 bg-white text-cyan-600 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)] shadow-[0_0_15px_rgba(0,255,255,0.5)] scale-105 z-10" : "border-2 border-cyan-100 bg-white text-gray-400 hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(0,255,255,0.2)]"}`}>
      {icon} {label}
    </button>
  );
}

// --- Views ---
function HudView() {
  const [filterType, setFilterType] = useState<"neo" | "exo">("neo");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = filterType === "neo" ? `${API_URL}/asteroids` : `${API_URL}/exoplanets`;
    axios.get(url).then(res => {
      setItems(res.data);
      if (res.data.length > 0) setSelected(res.data[0]);
      setLoading(false);
    });
  }, [filterType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-sm h-full">
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1 flex flex-col relative overflow-hidden">
          <div className="flex gap-2 mb-4 border-b border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] pb-2">
            <button onClick={() => setFilterType("neo")} className={`flex-1 py-1 text-xs text-center border ${filterType === "neo" ? "border-cyan-500 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] bg-cyan-900/20" : "border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] text-gray-500"}`}>NEO (Astéroïdes)</button>
            <button onClick={() => setFilterType("exo")} className={`flex-1 py-1 text-xs text-center border ${filterType === "exo" ? "border-cyan-500 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] bg-cyan-900/20" : "border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] text-gray-500"}`}>EXOPLANÈTES</button>
          </div>
          {loading ? <div className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] animate-pulse">Scan en cours...</div> : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {items.map((item, i) => (
                <button key={i} onClick={() => setSelected(item)} className={`w-full text-left p-3 border transition-colors ${selected?.name === item.name ? "border-cyan-500 bg-cyan-100 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]" : "border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] bg-white hover:border-gray-600 text-gray-600"}`}>
                  <span className="font-bold block truncate">{item.name}</span>
                  {filterType === "neo" && item.impact_prob > 5 && <span className="text-red-600 text-[10px] animate-pulse">CRITIQUE</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        {selected && (
          <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-6 h-full flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] pb-4 mb-6">
              {filterType === "neo" ? <Crosshair className="w-8 h-8 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] animate-[spin_4s_linear_infinite]" /> : <Globe className="w-8 h-8 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]" />}
              <div>
                <h2 className="text-3xl font-bold text-gray-800 tracking-widest">{selected.name}</h2>
                <p className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">{filterType === "neo" ? "Classification: Objet Géocroiseur" : `Hôte: ${selected.hostname}`}</p>
              </div>
            </div>
            {filterType === "neo" ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">DIAMÈTRE</div><div className="text-xl text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] ">{selected.d_max ? `${selected.d_max} km` : "N/A"}</div></div>
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">VITESSE RELATIVE</div><div className="text-xl text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] ">{selected.vel ? `${selected.vel} km/h` : "N/A"}</div></div>
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">MATÉRIAU</div><div className="text-xl text-gray-800">{selected.material || "INCONNU"}</div></div>
                <div className={`bg-white border p-4 ${selected.impact_prob > 5 ? "border-red-300" : "border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)]"}`}><div className="text-gray-500 text-xs">PROB. IMPACT</div><div className={`text-xl font-bold ${selected.impact_prob > 5 ? "text-red-600 animate-pulse" : "text-green-500"}`}>{selected.impact_prob}%</div></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">RAYON (Terre)</div><div className="text-xl text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] ">{selected.pl_rade || "N/A"}</div></div>
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">MASSE</div><div className="text-xl text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] ">{selected.pl_bmasse || "N/A"}</div></div>
                <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-4"><div className="text-gray-500 text-xs">PÉRIODE (Jours)</div><div className="text-xl text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] ">{selected.pl_orbper || "N/A"}</div></div>
              </div>
            )}
            <div className="flex-1 flex gap-4">
              {filterType === "neo" && (
                <div className="flex-1">
                  <h3 className="text-cyan-500 mb-2 text-xs">ANALYSE IA</h3>
                  <div className="bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)] p-3 text-gray-600 h-48 overflow-y-auto text-xs">{selected.risk || "Aucune."}</div>
                </div>
              )}
              <div className="w-1/2">
                <h3 className="text-cyan-500 mb-2 text-xs">MODÈLE 3D</h3>
                <Viewer3D targetName={selected.name} material={filterType === "neo" ? (selected.material || "rock") : "planet"} simType="shape" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiningView() {
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState<any>(null);
  useEffect(() => { axios.get(`${API_URL}/mining`).then(res => setData(res.data)); }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full font-mono text-sm">
      <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex flex-col h-full overflow-hidden">
        <h2 className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] font-bold mb-4">Cibles de Minage (Cliquez pour simuler)</h2>
        <div className="flex-1 overflow-auto border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-cyan-500 sticky top-0">
              <tr><th className="p-2">Nom</th><th className="p-2">Matériau</th><th className="p-2">Score</th></tr>
            </thead>
            <tbody>
              {data.map((row:any, i) => (
                <tr key={i} onClick={() => setSelected(row)} className={`border-b border-gray-100 cursor-pointer ${selected?.name === row.name ? "bg-cyan-100 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]" : "hover:bg-gray-100 text-gray-700"}`}>
                  <td className="p-2">{row.name}</td><td className="p-2">{row.material}</td><td className="p-2 text-green-400">{Math.round(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {selected ? (
          <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] font-bold mb-2">CIBLE: {selected.name}</h3>
              <p className="text-xs text-gray-600">Diamètre: {selected.diameter} km</p>
              <p className="text-xs text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)] mt-1 ">Vitesse intercept.: {selected.velocity} km/h</p>
            </div>
            <div className="w-[200px]"><Viewer3D targetName={selected.name} material={selected.material} velocity={selected.velocity} simType="velocity" /></div>
          </div>
        ) : (
          <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 text-gray-600 text-xs text-center">Sélectionnez une cible pour la simulation 3D.</div>
        )}
        <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" dataKey="velocity" name="Vitesse" stroke="#00FFFF" />
              <YAxis type="number" dataKey="diameter" name="Diamètre" stroke="#00FFFF" />
              <ZAxis type="number" dataKey="score" range={[50, 400]} />
              <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#0ff' }} itemStyle={{ color: '#0ff' }} />
              <Scatter name="Astéroïdes" data={data} fill="#00cc66" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ImpactView() {
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState<any>(null);
  useEffect(() => { axios.get(`${API_URL}/impacts`).then(res => setData(res.data)); }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full font-mono text-sm">
      <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex flex-col overflow-hidden">
        <h2 className="text-red-600 font-bold mb-4">Menaces (Cliquez pour simuler)</h2>
        <div className="flex-1 overflow-auto border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-red-600 sticky top-0">
              <tr><th className="p-2">Nom</th><th className="p-2">Prob%</th><th className="p-2">Énergie (Mt)</th></tr>
            </thead>
            <tbody>
              {data.map((row:any, i) => (
                <tr key={i} onClick={() => setSelected(row)} className={`border-b border-gray-100 cursor-pointer ${selected?.name === row.name ? "bg-red-900/30 text-red-300" : "hover:bg-gray-100 text-gray-700"}`}>
                  <td className="p-2">{row.name}</td><td className="p-2">{row.prob}%</td><td className="p-2 text-red-600">{row.megatons.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {selected ? (
          <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-red-600 font-bold mb-2">IMPACT IMMINENT: {selected.name}</h3>
              <p className="text-xs text-gray-600">Diamètre: {selected.diameter} km</p>
              <p className="text-xs text-red-600 mt-1  animate-pulse">Vitesse d'impact: {selected.velocity} km/h</p>
            </div>
            <div className="w-[200px]"><Viewer3D targetName={selected.name} material="rock" velocity={selected.velocity} simType="velocity" /></div>
          </div>
        ) : (
          <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 text-gray-600 text-xs text-center">Sélectionnez une menace pour la simulation 3D.</div>
        )}
        <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-4 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" stroke="#ff3333" />
              <YAxis stroke="#ff3333" />
              <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#ff3333' }} itemStyle={{ color: '#ff3333' }} />
              <Bar dataKey="megatons" fill="#ff3333" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function GraphView() {
  const [data, setData] = useState({ nodes: [], links: [] });
  useEffect(() => { axios.get(`${API_URL}/graph`).then(res => setData(res.data)); }, []);
  return (
    <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white h-full relative">
      <ForceGraph2D graphData={data} nodeLabel="name" nodeColor={(node:any) => node.label === 'Star' ? '#FFD700' : node.label === 'Exoplanet' ? '#00FFFF' : '#FF4500'} linkColor={(link:any) => link.relation === 'THREATENS' ? '#ff3333' : '#444'} backgroundColor="#000000" linkDirectionalArrowLength={3.5} />
    </div>
  );
}

function ExoplanetsView() {
  const [data, setData] = useState([]);
  useEffect(() => { axios.get(`${API_URL}/exoplanets`).then(res => setData(res.data)); }, []);
  return (
    <div className="border-2 border-cyan-100 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white h-full p-6 flex flex-col font-mono text-sm">
      <div className="flex-1 overflow-auto bg-white border border-cyan-100 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-cyan-500 sticky top-0"><tr><th className="p-3">Nom</th><th className="p-3">Hôte</th><th className="p-3">Rayon</th><th className="p-3">Masse</th></tr></thead>
          <tbody>
            {data.map((row:any, i) => <tr key={i} className="border-b border-gray-100 hover:bg-gray-100/50"><td className="p-3 text-cyan-600 font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">{row.name}</td><td className="p-3">{row.hostname}</td><td className="p-3">{row.pl_rade}</td><td className="p-3">{row.pl_bmasse}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
