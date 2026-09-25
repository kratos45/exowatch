"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import confetti from "canvas-confetti";
import { Award, ShieldAlert, CheckCircle, Crosshair, Star, Zap, Flame, Sparkles } from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

export default function ThreatHunterGamification() {
  const [gamificationState, setGamificationState] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentXP, setCurrentXP] = useState<number>(1450);
  const [recentNotification, setRecentNotification] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API_URL}/gamification/status`).then((res) => {
      setGamificationState(res.data);
      setCurrentXP(res.data.xp || 1450);
    });
  }, []);

  const handleAction = async (decision: string) => {
    const task = gamificationState?.pending_tasks?.[currentIndex];
    if (!task) return;

    try {
      const res = await axios.post(`${API_URL}/gamification/action`, {
        task_id: task.id,
        decision,
      });

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      setCurrentXP((prev) => prev + res.data.earned_xp);
      setRecentNotification(res.data.message);

      setTimeout(() => {
        setRecentNotification(null);
        setCurrentIndex((prev) => (prev + 1) % (gamificationState?.pending_tasks?.length || 1));
      }, 1500);
    } catch (err) {}
  };

  const tasks = gamificationState?.pending_tasks || [];
  const currentTask = tasks[currentIndex];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-sm h-full">
      {/* Colonne Gauche : Carte d'Analyse du Chasseur de Menaces (8/12) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="border-2 border-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.15)] rounded-xl bg-white p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-3">
            <div className="flex items-center gap-2">
              <Crosshair className="w-6 h-6 text-cyan-600 animate-spin" />
              <div>
                <h2 className="text-cyan-800 font-extrabold uppercase tracking-wider text-base">
                  Mode Chasseur de Menaces (Crowdsourcing Scientifique)
                </h2>
                <p className="text-[11px] text-gray-500">
                  Inspectez les signaux spectraux, confirmez les classifications d'orbites et gagnez des galons de Défense Planétaire.
                </p>
              </div>
            </div>
            <span className="text-xs bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full font-bold">
              Observation #{currentIndex + 1} / {tasks.length || 1}
            </span>
          </div>

          {/* Active Target Card */}
          {currentTask ? (
            <div className="border-2 border-dashed border-cyan-300 rounded-xl p-5 bg-cyan-50/20 relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">
                    CORPS CÉLESTE SOUS ÉVALUATION
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 mt-0.5">{currentTask.asteroid_name}</h3>
                </div>
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2.5 py-1 rounded font-bold animate-pulse">
                  Validation Requise
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                <div className="bg-white p-3 rounded-lg border border-cyan-200 shadow-sm">
                  <div className="text-[10px] text-gray-500">SPECTRE ESTIMÉ</div>
                  <div className="text-sm font-bold text-gray-900 mt-1">{currentTask.spectral_signature}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-cyan-200 shadow-sm">
                  <div className="text-[10px] text-gray-500">DIAMÈTRE</div>
                  <div className="text-sm font-bold text-cyan-700 mt-1">{currentTask.diameter} km</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-cyan-200 shadow-sm">
                  <div className="text-[10px] text-gray-500">VITESSE SCANNÉE</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">{currentTask.velocity.toLocaleString()} km/h</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-cyan-200 shadow-sm">
                  <div className="text-[10px] text-gray-500">PARAMÈTRES ORBITE</div>
                  <div className="text-sm font-bold text-purple-700 mt-1">{currentTask.orbit}</div>
                </div>
              </div>

              {/* Challenge description */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-700 mb-5">
                <span className="font-bold text-cyan-800">Mission d'Analyse : </span>
                {currentTask.challenge}
              </div>

              {/* Action Buttons Deck */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleAction("classify_safe")}
                  className="py-3 px-2 bg-green-50 hover:bg-green-100 border border-green-300 text-green-800 font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={15} /> Confirmer Bénin
                </button>

                <button
                  onClick={() => handleAction("classify_hazard")}
                  className="py-3 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert size={15} /> Classer comme Suspect
                </button>

                <button
                  onClick={() => handleAction("launch_dart")}
                  className="py-3 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  <Zap size={15} /> Déviation DART
                </button>
              </div>

              {/* Notification Banner */}
              {recentNotification && (
                <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-900 rounded-lg font-bold text-xs flex items-center gap-2 animate-bounce">
                  <Sparkles size={16} /> {recentNotification}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">Toutes les observations ont été vérifiées !</div>
          )}
        </div>
      </div>

      {/* Colonne Droite : Progression, Galons & Badges (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Officer Rank Card */}
        <div className="border-2 border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.15)] rounded-xl bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-cyan-100 pb-3">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-gray-900 uppercase tracking-wider text-sm">Profil d'Officier Défense</h3>
          </div>

          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase">GRADE ACTUEL</div>
            <div className="text-base font-black text-cyan-800 mt-0.5">
              {gamificationState?.officer_rank || "Commandant Défense Planétaire"}
            </div>
          </div>

          {/* XP Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
              <span>Progression XP</span>
              <span className="text-cyan-600 font-bold">{currentXP} / 2,000 XP</span>
            </div>
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (currentXP / 2000) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 text-right">Prochain grade : Directeur de Mission NASA</div>
          </div>

          {/* Badges Deck */}
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Star size={13} className="text-amber-500" /> Badges Scientifiques Obtenus
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gamificationState?.badges?.map((badge: string, i: number) => (
                <span
                  key={i}
                  className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
                >
                  🎖️ {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
