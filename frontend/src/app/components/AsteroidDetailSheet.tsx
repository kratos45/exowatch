"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useExoWatchStore } from "../store";
import ConfidenceMeter from "./ConfidenceMeter";
import ThreatBadge from "./ThreatBadge";
import {
  Crosshair,
  Compass,
  AlertTriangle,
  Pickaxe,
  FileText,
  Box,
  Layers,
  Sparkles,
  Zap,
  Activity,
  Share2,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";
const STATIC_URL = "http://127.0.0.1:8000/static";

export default function AsteroidDetailSheet() {
  const { selectedTargetName, setSelectedTargetName, setActiveTab, addToast } = useExoWatchStore();
  const [asteroidList, setAsteroidList] = useState<any[]>([]);
  const [asteroid, setAsteroid] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 3D rendering state
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/asteroids`).then((res) => {
      setAsteroidList(res.data);
      const found = res.data.find((a: any) => a.name === selectedTargetName) || res.data[0];
      if (found) {
        setAsteroid(found);
      }
      setLoading(false);
    });
  }, [selectedTargetName]);

  const handleSelect = (name: string) => {
    setSelectedTargetName(name);
    setGifUrl(null);
  };

  const handleGenerate3D = async (simType: "shape" | "velocity") => {
    if (!asteroid) return;
    setIsGenerating3D(true);
    try {
      let url = `${API_URL}/generate-3d`;
      let payload: any = { name: asteroid.name, material: asteroid.material || "Silicates" };
      if (simType === "velocity") {
        url = `${API_URL}/simulate-velocity`;
        payload = { name: asteroid.name, velocity: asteroid.vel || 54000 };
      }
      const res = await axios.post(url, payload);
      setGifUrl(`${STATIC_URL}/${res.data.gif_path}?t=${new Date().getTime()}`);
      addToast({
        type: "success",
        title: "Rendu 3D Prêt",
        message: `Simulation ${simType} générée avec succès pour ${asteroid.name}.`,
      });
    } catch (err) {
      addToast({
        type: "danger",
        title: "Erreur Rendu 3D",
        message: "Échec de génération du modèle 3D.",
      });
    }
    setIsGenerating3D(false);
  };

  if (!asteroid) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans h-full">
      {/* Colonne Gauche : Sélecteur de Cible (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="hologram-card p-4 flex-1 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2 mb-3">
            <span className="text-xs font-technical font-bold text-gray-500 dark:text-gray-400 uppercase">
              Catalogue Cibles ({asteroidList.length})
            </span>
            <span className="text-[10px] font-technical text-cyan-600 dark:text-cyan-400 font-bold">
              NEO DATABASE
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {asteroidList.map((a, i) => {
              const isSelected = asteroid.name === a.name;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(a.name)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-50/70 dark:bg-cyan-950/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "border-gray-100 dark:border-slate-800/80 hover:border-cyan-300 dark:hover:border-slate-700 bg-gray-50/40 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{a.name}</div>
                    <div className="text-[10px] font-technical text-gray-500 dark:text-gray-400 mt-0.5">
                      {a.material || "Silicates"} • {a.d_max} km
                    </div>
                  </div>
                  <ThreatBadge score={a.threat_centrality ? a.threat_centrality * 1000 : 0.8} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Colonne Droite : Fiche Détaillée Complète (8/12) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="hologram-card p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-technical uppercase font-bold text-cyan-600 dark:text-cyan-400">
                  FICHE ASTÉROÏDE V2.5
                </span>
                <ThreatBadge score={asteroid.threat_centrality ? asteroid.threat_centrality * 1000 : 0.8} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{asteroid.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Classification : Objet Géocroiseur Proche • Composition : {asteroid.material || "Silicates"}
              </p>
            </div>

            {/* Confidence Meter Circular Gauge */}
            <div className="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center">
              <ConfidenceMeter
                score={asteroid.confidence_score || 88}
                size={58}
                showBasis={true}
                basisText={asteroid.evidence_basis || "NEOWISE + Spectre Optique"}
              />
            </div>
          </div>

          {/* Physical & Orbital Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-technical text-xs">
            <div className="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="text-[10px] text-gray-400 font-bold uppercase">DIAMÈTRE MOYEN</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">{asteroid.d_max} km</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Rayon: {(parseFloat(asteroid.d_max || 1) / 2).toFixed(2)} km</div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="text-[10px] text-gray-400 font-bold uppercase">VITESSE RELATIVE</div>
              <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {Math.round(asteroid.vel)} km/h
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{(asteroid.vel / 3600).toFixed(1)} km/s</div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="text-[10px] text-gray-400 font-bold uppercase">DEMI-GRAND AXE (a)</div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">
                {asteroid.semi_major_axis ? parseFloat(asteroid.semi_major_axis).toFixed(3) : "1.458"} UA
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Excentricité: {asteroid.eccentricity ? parseFloat(asteroid.eccentricity).toFixed(3) : "0.223"}</div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="text-[10px] text-gray-400 font-bold uppercase">PÉRIODE ORBITALE</div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400 mt-1">
                {asteroid.orbital_period ? Math.round(asteroid.orbital_period) : "643"} jours
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {asteroid.orbital_period ? (asteroid.orbital_period / 365.25).toFixed(2) : "1.76"} ans
              </div>
            </div>
          </div>

          {/* Dual Column: AI Qualitative Assessment vs 3D Synthetic Model Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Qualitative Assessment Card */}
            <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-technical font-bold text-cyan-700 dark:text-cyan-400 uppercase flex items-center gap-1.5 mb-2">
                  <Sparkles size={14} className="text-cyan-500" /> Analyse Géologique & Risque IA
                </h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                  {asteroid.risk || "Orbite nominale sans anomalie cinétique détectée. Forte teneur minérale exploitable."}
                </p>
              </div>

              {/* Action Buttons to navigate to other views with this target */}
              <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex flex-wrap gap-2 text-xs font-technical">
                <button
                  onClick={() => setActiveTab("impact")}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow"
                >
                  <AlertTriangle size={13} /> Simuler Impact
                </button>
                <button
                  onClick={() => setActiveTab("mining")}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow"
                >
                  <Pickaxe size={13} /> Scénario Minier
                </button>
                <button
                  onClick={() => setActiveTab("agent")}
                  className="px-3 py-1.5 bg-gray-900 dark:bg-slate-800 hover:bg-black text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow"
                >
                  <FileText size={13} /> Dossier NASA
                </button>
              </div>
            </div>

            {/* 3D Synthetic Model Viewer Box */}
            <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center min-h-[190px]">
              {gifUrl ? (
                <img src={gifUrl} alt="Modèle 3D" className="w-full h-36 object-contain rounded-lg" />
              ) : isGenerating3D ? (
                <div className="text-cyan-600 dark:text-cyan-400 text-xs font-bold font-technical animate-pulse flex items-center gap-2">
                  <Box className="animate-spin" size={16} /> Génération du modèle Shap-E...
                </div>
              ) : (
                <div className="text-center text-gray-400 text-xs font-technical">
                  <Box className="w-8 h-8 mx-auto mb-1 text-gray-400 opacity-30" />
                  Visualisation Shap-E / Vitesse proportionnelle
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleGenerate3D("shape")}
                  disabled={isGenerating3D}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-cyan-400/50 hover:bg-cyan-50 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-bold font-technical transition disabled:opacity-50"
                >
                  Modèle 3D (Shap-E)
                </button>
                <button
                  onClick={() => handleGenerate3D("velocity")}
                  disabled={isGenerating3D}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-cyan-400/50 hover:bg-cyan-50 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-bold font-technical transition disabled:opacity-50"
                >
                  Simuler Vitesse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
