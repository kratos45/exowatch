"use client";

import React, { useEffect, useState } from "react";
import { useExoWatchStore } from "../store";
import ConfidenceMeter from "./ConfidenceMeter";
import ThreatBadge from "./ThreatBadge";
import {
  Compass,
  AlertTriangle,
  FileText,
  MessageSquare,
  Terminal,
  Send,
  Sparkles,
  ExternalLink,
  Box,
} from "lucide-react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

export default function ContextualSidebar() {
  const { selectedTargetName, setSelectedTargetName, setActiveTab, addToast } = useExoWatchStore();
  const [targetData, setTargetData] = useState<any>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);

  useEffect(() => {
    if (!selectedTargetName) return;
    axios.get(`${API_URL}/asteroids`).then((res) => {
      const found = res.data.find((a: any) => a.name === selectedTargetName);
      if (found) {
        setTargetData(found);
      }
    }).catch(() => {});
  }, [selectedTargetName]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput) return;
    setIsChatting(true);
    try {
      const res = await axios.post(`${API_URL}/chat`, {
        question: `${chatInput} concernant l'astéroïde ${selectedTargetName}`,
      });
      setChatSummary(res.data.summary || "Réponse traitée.");
    } catch (err) {
      addToast({
        type: "danger",
        title: "Erreur Uplink",
        message: "Impossible de joindre le service Text-to-Cypher.",
      });
    }
    setIsChatting(false);
  };

  return (
    <div className="h-full flex flex-col gap-3 font-sans">
      {/* Target Focus Hologram Card */}
      <div className="hologram-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-cyan-100 dark:border-slate-800 pb-2.5">
          <span className="text-[10px] font-technical uppercase font-bold text-cyan-600 dark:text-cyan-400 tracking-wider">
            Cible Verrouillée (HUD)
          </span>
          <ThreatBadge
            score={targetData?.threat_centrality ? targetData.threat_centrality * 1000 : 0.8}
            level={targetData?.pha ? "critical" : "nominal"}
          />
        </div>

        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-gray-100 truncate">
            {selectedTargetName || "Aucune cible sélectionnée"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {targetData?.material || "Chondrite / Silicates"}
          </p>
        </div>

        {/* Quick Telemetry */}
        <div className="grid grid-cols-2 gap-2 text-xs font-technical">
          <div className="bg-gray-50 dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
            <div className="text-[9px] text-gray-400">DIAMÈTRE</div>
            <div className="font-bold text-gray-800 dark:text-gray-200 mt-0.5">
              {targetData?.d_max ? `${targetData.d_max} km` : "0.45 km"}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
            <div className="text-[9px] text-gray-400">VITESSE INTERCEPT.</div>
            <div className="font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
              {targetData?.vel ? `${Math.round(targetData.vel)} km/h` : "52,000 km/h"}
            </div>
          </div>
        </div>

        {/* Reusable Confidence Meter */}
        <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
          <ConfidenceMeter
            score={targetData?.confidence_score || 88}
            size={52}
            strokeWidth={5}
            showBasis={true}
            basisText={targetData?.evidence_basis || "NEOWISE IR + Spectroscopie"}
          />
        </div>

        {/* Quick Navigation Action Grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] font-technical">
          <button
            onClick={() => setActiveTab("solar")}
            className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 font-bold flex flex-col items-center gap-1 transition"
          >
            <Compass size={14} />
            <span>Vue 3D</span>
          </button>
          <button
            onClick={() => setActiveTab("impact")}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 font-bold flex flex-col items-center gap-1 transition"
          >
            <AlertTriangle size={14} />
            <span>Impact</span>
          </button>
          <button
            onClick={() => setActiveTab("detail")}
            className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold flex flex-col items-center gap-1 transition"
          >
            <ExternalLink size={14} />
            <span>Fiche</span>
          </button>
        </div>
      </div>

      {/* Mini Uplink Chat (NL ➔ Cypher) */}
      <div className="hologram-card p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b border-cyan-100 dark:border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400">
            <MessageSquare size={14} />
            <span>Uplink Copilote IA</span>
          </div>
          <span className="text-[9px] font-technical text-gray-400">NL ➔ Cypher</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 text-xs pr-1">
          <div className="bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-gray-300 text-[11px] leading-relaxed">
            Interrogez l'IA sur cette cible ou sur le graphe spatial.
          </div>

          {chatSummary && (
            <div className="bg-cyan-50/50 dark:bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 text-[11px] leading-relaxed">
              {chatSummary}
            </div>
          )}

          {isChatting && (
            <div className="text-cyan-600 dark:text-cyan-400 text-[11px] font-bold animate-pulse flex items-center gap-1.5">
              <Sparkles size={12} /> Requête en cours...
            </div>
          )}
        </div>

        <form onSubmit={handleChat} className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Poser une question..."
              disabled={isChatting}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-2 pr-8 text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isChatting}
              className="absolute right-2 top-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 transition"
            >
              <Send size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
