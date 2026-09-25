"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Bot,
  Terminal,
  CheckCircle2,
  FileText,
  Download,
  Copy,
  Check,
  Sparkles,
  Send,
  Layers,
  AlertCircle,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const PRESET_PROMPTS = [
  "Trouve-moi les 3 astéroïdes les plus rentables à miner ET compare leur delta-V ET explique pourquoi",
  "Identifie les cibles prioritaires ayant un faible coût de propulsion ET une forte teneur en métaux",
  "Quels géocroiseurs combinent un risque potentiel d'impact ET une opportunité d'exploitation minière ?",
];

export default function MultiStepAgentView() {
  const [instruction, setInstruction] = useState<string>(PRESET_PROMPTS[0]);
  const [agentResponse, setAgentResponse] = useState<any>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  // NASA Mission Report Generator state
  const [asteroidList, setAsteroidList] = useState<any[]>([]);
  const [reportTarget, setReportTarget] = useState<string>("433 Eros (A898 PA)");
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch real asteroids from Neo4j on load
  useEffect(() => {
    axios
      .get(`${API_URL}/asteroids`)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setAsteroidList(res.data);
          setReportTarget(res.data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  const handleExecuteAgent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!instruction) return;
    setIsRunning(true);
    setAgentError(null);
    setAgentResponse(null);
    try {
      const res = await axios.post(`${API_URL}/agent/multi-step`, { instruction });
      setAgentResponse(res.data);
    } catch (err: any) {
      setAgentError(err.response?.data?.detail || "Erreur lors de l'exécution de l'agent multi-étapes.");
    }
    setIsRunning(false);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const res = await axios.post(`${API_URL}/generate-mission-report`, { target_name: reportTarget });
      setReportMarkdown(res.data.markdown_report);
    } catch (err: any) {
      setReportError(err.response?.data?.detail || "Erreur lors de la génération du rapport.");
    }
    setIsGeneratingReport(false);
  };

  const handleDownloadReport = () => {
    if (!reportMarkdown) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NASA_MISSION_REPORT_${reportTarget.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    if (!reportMarkdown) return;
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-sm h-full">
      {/* Colonne Principale : Agent Multi-Étapes (7/12) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-cyan-600 animate-bounce" />
              <div>
                <h2 className="text-cyan-700 font-extrabold uppercase tracking-wider text-base">
                  Agent Autonome Multi-Étapes
                </h2>
                <p className="text-[11px] text-gray-500">
                  Décomposition d'intentions complexes, requêtes Cypher composées & optimisation astrodynamique
                </p>
              </div>
            </div>
            <span className="bg-cyan-50 border border-cyan-300 text-cyan-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-[0_0_8px_rgba(0,255,255,0.3)]">
              <Sparkles size={12} /> QUALINOVA ARCH
            </span>
          </div>

          {/* Quick Prompts Chips */}
          <div className="flex flex-wrap gap-2">
            {PRESET_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => setInstruction(p)}
                className="text-[11px] bg-gray-50 hover:bg-cyan-50 border border-gray-200 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 px-3 py-1.5 rounded-full transition text-left"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Query Input */}
          <form onSubmit={handleExecuteAgent} className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Entrez une directive complexe à l'agent..."
              disabled={isRunning}
              className="flex-1 bg-white border-2 border-cyan-300 rounded-lg p-3 text-xs font-bold text-gray-800 outline-none focus:border-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.2)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isRunning}
              className="px-5 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs uppercase rounded-lg transition shadow-[0_0_15px_rgba(0,255,255,0.4)] disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={14} /> {isRunning ? "Orchestration..." : "Lancer"}
            </button>
          </form>

          {agentError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} /> {agentError}
            </div>
          )}

          {/* Step Execution Workflow Pipeline */}
          {agentResponse && (
            <div className="mt-2 space-y-4">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} className="text-cyan-600" /> Étapes du Pipeline Exécutif
              </div>
              <div className="space-y-2">
                {agentResponse.steps?.map((step: any, index: number) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 border border-cyan-200 rounded-lg flex items-start gap-3 shadow-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">{step.title}</span>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                          COMPLÉTÉ
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1">{step.description}</p>
                      {step.detail && (
                        <p className="text-[10px] text-cyan-700 font-bold mt-1 bg-cyan-50/60 p-1.5 rounded border border-cyan-100">
                          ➔ {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Intermediate Data Table */}
              {agentResponse.top_candidates?.length > 0 && (
                <div className="border border-cyan-200 rounded-lg overflow-hidden">
                  <div className="bg-cyan-100/60 px-3 py-1.5 text-[11px] font-bold text-cyan-800 uppercase">
                    Données d'Optimisation Astrodynamique
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Astéroïde</th>
                        <th className="p-2">Matériau</th>
                        <th className="p-2">Diamètre</th>
                        <th className="p-2">Delta-V</th>
                        <th className="p-2">Score Rentabilité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentResponse.top_candidates.map((c: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 text-gray-800">
                          <td className="p-2 font-bold text-cyan-700">{c.name}</td>
                          <td className="p-2">{c.material}</td>
                          <td className="p-2">{c.diameter_km} km</td>
                          <td className="p-2 font-bold text-cyan-600">{c.delta_v_ms} m/s</td>
                          <td className="p-2 font-bold text-green-600">{c.economic_score} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Full Executive Synthesis */}
              <div className="p-4 bg-cyan-50/40 border-2 border-cyan-300 rounded-xl">
                <div className="flex items-center gap-2 text-cyan-800 font-bold text-xs uppercase mb-2">
                  <Terminal size={14} /> Synthèse Opérationnelle NASA JPL
                </div>
                <div className="text-gray-800 text-[12px] leading-relaxed whitespace-pre-wrap font-sans">
                  {agentResponse.synthesis}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Colonne Droite : Générateur de Rapports de Mission NASA (5/12) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-600" />
              <h3 className="font-extrabold text-gray-900 uppercase tracking-wider text-sm">
                Rapports de Mission NASA Automatiques
              </h3>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">NASA/TM-2026</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">CIBLE DE MISSION (NEO)</label>
              <select
                value={reportTarget}
                onChange={(e) => setReportTarget(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded p-2 text-xs font-bold text-gray-800 outline-none focus:border-cyan-500"
              >
                {asteroidList.length > 0 ? (
                  asteroidList.map((a, i) => (
                    <option key={i} value={a.name}>
                      {a.name} ({a.material || "Silicates"} - {a.d_max || 0.5} km)
                    </option>
                  ))
                ) : (
                  <>
                    <option value="433 Eros (A898 PA)">433 Eros (Silicates - 16 km)</option>
                    <option value="719 Albert (A911 TB)">719 Albert (Chondrite - 2.6 km)</option>
                    <option value="6178 (1986 DA)">6178 1986 DA (Fer-Nickel Métallique - 3.1 km)</option>
                    <option value="1036 Ganymed (A924 UB)">1036 Ganymed (Silicate - 31 km)</option>
                    <option value="1566 Icarus (1949 MA)">1566 Icarus (Roche - 1.4 km)</option>
                  </>
                )}
              </select>
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs uppercase rounded-lg transition shadow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText size={14} /> {isGeneratingReport ? "Génération du Dossier en cours..." : "Générer le Dossier NASA"}
            </button>
          </div>

          {reportError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} /> {reportError}
            </div>
          )}

          {/* Render Generated Report */}
          {reportMarkdown ? (
            <div className="flex-1 flex flex-col gap-2 mt-2 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Dossier Technique Prêt
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-bold transition border border-gray-300"
                  >
                    {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[11px] font-bold transition shadow"
                  >
                    <Download size={12} /> Télécharger (.md)
                  </button>
                </div>
              </div>

              <div className="flex-1 max-h-[380px] overflow-y-auto bg-gray-50 border border-gray-200 p-4 rounded-lg text-[11px] leading-relaxed text-gray-800 whitespace-pre-wrap font-mono custom-scrollbar">
                {reportMarkdown}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-gray-300 rounded-lg text-gray-400 text-xs text-center">
              Sélectionnez une cible et cliquez sur "Générer le Dossier NASA" pour exporter un rapport technique complet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
