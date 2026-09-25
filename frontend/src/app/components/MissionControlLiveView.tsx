"use client";

import React, { useEffect, useState } from "react";
import { Terminal, ShieldAlert, Radio, AlertOctagon, RefreshCw, Zap, Bell } from "lucide-react";
import ThreatBadge from "./ThreatBadge";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "CRIT";
  source: string;
  message: string;
}

export default function MissionControlLiveView() {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: "08:45:12",
      level: "INFO",
      source: "NEOWISE_IR",
      message: "Scan infrarouge terminé sur secteur Orion-B. 14 géocroiseurs confirmés.",
    },
    {
      timestamp: "08:45:18",
      level: "WARN",
      source: "JPL_HORIZONS",
      message: "Mise à jour éphémérides 2024 BX1 : MOID recalculé à 0.018 UA.",
    },
    {
      timestamp: "08:45:25",
      level: "CRIT",
      source: "SENTRY_WATCH",
      message: "ALERTE : Seuil de centralité dépassé pour 99942 Apophis (Score: 3.82 pts).",
    },
    {
      timestamp: "08:45:30",
      level: "INFO",
      source: "NEO4J_GDS",
      message: "Algorithme PageRank recalculé sur 2,407 nœuds. Latence: 3.2ms.",
    },
  ]);

  // Simulate incoming live telemetry stream
  useEffect(() => {
    const streamSources = ["PALOMAR_SURVEY", "TESS_ORBITAL", "SENTRY_AUTONOMOUS", "DART_DEVIATION", "GOLDSTONE_RADAR"];
    const streamMessages = [
      "Signature spectrale affinée : chondrite carbonée détectée avec albédo p_V=0.14.",
      "Calcul de vecteur d'état orbital Kepler : convergence à 99.98% de probabilité.",
      "Télémesure Doppler reçue : vitesse radiale confirmée à 21.4 km/s.",
      "Optimisation de fenêtre de transfert Hohmann : Delta-V estimé à 4,210 m/s.",
      "Alerte de résonance 3:1 avec Jupiter pour le groupe d'astéroïdes Apollon.",
    ];

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const randomSource = streamSources[Math.floor(Math.random() * streamSources.length)];
      const randomMsg = streamMessages[Math.floor(Math.random() * streamMessages.length)];
      const level = Math.random() > 0.8 ? "WARN" : "INFO";

      setLogs((prev) => [
        {
          timestamp: timeStr,
          level,
          source: randomSource,
          message: randomMsg,
        },
        ...prev.slice(0, 19),
      ]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs h-full">
      {/* Colonne Gauche : Statut DEFCON & Indicateurs Live (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="hologram-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">
              Défense Planétaire
            </span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>

          {/* DEFCON Box */}
          <div className="bg-red-500/10 border-2 border-red-500 rounded-2xl p-4 text-center shadow-[0_0_20px_rgba(239,68,68,0.25)]">
            <div className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">
              ÉTAT D'ALERTE ACTUEL
            </div>
            <div className="text-3xl font-black text-red-600 dark:text-red-500 my-1">
              DEFCON 3
            </div>
            <div className="text-[11px] text-red-700 dark:text-red-400 font-bold">
              VIGILANCE RENFORCÉE (SENTRY ACTIVE)
            </div>
          </div>

          {/* Telemetry Stats */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
              <span className="text-gray-500">Flux d'événements :</span>
              <span className="font-bold text-emerald-500">LIVE (WEBSOCKET SIM)</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
              <span className="text-gray-500">Fréquence de scan :</span>
              <span className="font-bold text-cyan-500">10 Hz</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
              <span className="text-gray-500">Sensibilité Sentry :</span>
              <span className="font-bold text-amber-500">IP &gt; 1e-6</span>
            </div>
          </div>
        </div>
      </div>

      {/* Colonne Droite : Terminal Log Temps Réel (8/12) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="hologram-card p-5 flex-1 flex flex-col min-h-[460px] bg-slate-950 text-cyan-400 border-2 border-cyan-400/40 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-black text-white uppercase tracking-wider text-sm">
                Journal Télémétrique Mission Control (JPL SSD Feed)
              </span>
            </div>
            <span className="text-[10px] text-cyan-500 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              SYSLOG LIVE
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-[11px] leading-relaxed">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`p-2 rounded border flex items-start gap-2.5 transition-all ${
                  log.level === "CRIT"
                    ? "bg-red-950/40 border-red-800 text-red-300"
                    : log.level === "WARN"
                    ? "bg-amber-950/30 border-amber-800 text-amber-300"
                    : "bg-slate-900/40 border-cyan-900/40 text-cyan-300"
                }`}
              >
                <span className="text-gray-400 select-none">[{log.timestamp}]</span>
                <span
                  className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                    log.level === "CRIT"
                      ? "bg-red-700 text-white"
                      : log.level === "WARN"
                      ? "bg-amber-700 text-white"
                      : "bg-cyan-800 text-white"
                  }`}
                >
                  {log.level}
                </span>
                <span className="font-bold text-gray-300">[{log.source}]</span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
