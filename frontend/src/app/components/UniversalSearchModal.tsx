"use client";

import React, { useEffect, useState } from "react";
import { Search, Compass, AlertTriangle, Pickaxe, Share2, Bot, ArrowRight, X } from "lucide-react";
import { useExoWatchStore } from "../store";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

const QUICK_ACTIONS = [
  { id: "cockpit", label: "Dashboard / Cockpit Global", icon: Compass, tab: "cockpit" },
  { id: "solar", label: "Cockpit 3D Système Solaire", icon: Compass, tab: "solar" },
  { id: "impact", label: "Simulateur d'Impact Terrestre", icon: AlertTriangle, tab: "impact" },
  { id: "mining", label: "Comparateur de Scénarios de Minage", icon: Pickaxe, tab: "mining" },
  { id: "graph", label: "Explorateur Topologique Neo4j", icon: Share2, tab: "graph" },
  { id: "agent", label: "Agent Autonome & Rapports NASA", icon: Bot, tab: "agent" },
];

export default function UniversalSearchModal() {
  const { isSearchOpen, setIsSearchOpen, setActiveTab, setSelectedTargetName } = useExoWatchStore();
  const [query, setQuery] = useState("");
  const [asteroids, setAsteroids] = useState<any[]>([]);

  useEffect(() => {
    // Keyboard shortcut handler (Cmd+K or Ctrl+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      } else if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen && asteroids.length === 0) {
      axios.get(`${API_URL}/asteroids`).then((res) => {
        setAsteroids(res.data);
      }).catch(() => {});
    }
  }, [isSearchOpen, asteroids.length]);

  if (!isSearchOpen) return null;

  const filteredAsteroids = asteroids
    .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()) || (a.material && a.material.toLowerCase().includes(query.toLowerCase())))
    .slice(0, 6);

  const filteredActions = QUICK_ACTIONS.filter((act) => act.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelectAsteroid = (name: string) => {
    setSelectedTargetName(name);
    setActiveTab("detail");
    setIsSearchOpen(false);
    setQuery("");
  };

  const handleSelectView = (tab: string) => {
    setActiveTab(tab);
    setIsSearchOpen(false);
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-cyan-400/60 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.3)] overflow-hidden font-sans">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-cyan-500 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un astéroïde, une vue ou lancer une action... (Échap pour fermer)"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 font-medium"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results Deck */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {/* Asteroids List */}
          {filteredAsteroids.length > 0 && (
            <div>
              <div className="text-[10px] font-technical uppercase font-bold text-gray-400 dark:text-gray-500 px-3 py-1">
                Astéroïdes & Cibles Géocroiseurs
              </div>
              <div className="space-y-1 mt-1">
                {filteredAsteroids.map((ast, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectAsteroid(ast.name)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-left transition group"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        {ast.name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {ast.material || "Silicates"} • Diamètre: {ast.d_max || "0.5"} km
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Navigation Views */}
          {filteredActions.length > 0 && (
            <div>
              <div className="text-[10px] font-technical uppercase font-bold text-gray-400 dark:text-gray-500 px-3 py-1">
                Navigation & Outils
              </div>
              <div className="space-y-1 mt-1">
                {filteredActions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={() => handleSelectView(act.tab)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-left transition group"
                    >
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        <Icon className="w-4 h-4 text-cyan-500" />
                        <span>{act.label}</span>
                      </div>
                      <span className="text-[10px] font-technical text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Aller à
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Keybind Info */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-gray-400 font-technical">
          <span>Recherche Intégrée ExoWatch v2.5</span>
          <span className="flex items-center gap-2">
            <kbd className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-1.5 py-0.5 rounded">
              Esc
            </kbd>{" "}
            Fermer
          </span>
        </div>
      </div>
    </div>
  );
}
