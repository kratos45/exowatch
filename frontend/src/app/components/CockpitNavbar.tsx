"use client";

import React, { useEffect } from "react";
import { useExoWatchStore } from "../store";
import { Moon, Sun, Search, Radio, Database, ShieldAlert, Cpu } from "lucide-react";

export default function CockpitNavbar() {
  const { isDarkMode, toggleDarkMode, setIsSearchOpen, systemStatus } = useExoWatchStore();

  // Sync dark mode class to HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <header className="border-b-2 border-cyan-400/40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 shadow-[0_4px_25px_rgba(6,182,212,0.15)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <span className="text-2xl drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]">🪐</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-widest text-cyan-700 dark:text-cyan-400 uppercase">
                ExoWatch
              </h1>
              <span className="text-[10px] font-technical bg-cyan-100/70 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded font-bold border border-cyan-300 dark:border-cyan-800">
                v2.5 COCKPIT
              </span>
            </div>
            <div className="text-[9px] text-gray-500 dark:text-gray-400 tracking-wider font-technical hidden sm:block">
              PLANETARY DEFENSE & DEEP SPACE KNOWLEDGE GRAPH
            </div>
          </div>
        </div>

        {/* Telemetry Status Indicators (Console de vaisseau) */}
        <div className="hidden md:flex items-center gap-4 text-xs font-technical">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]" />
            <span className="font-bold">NASA API: ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400">
            <Database size={13} className="text-cyan-500" />
            <span className="font-bold">NEO4J: {systemStatus.neo4jLatencyMs}ms</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400">
            <ShieldAlert size={13} className="text-amber-500" />
            <span className="font-bold">DEFCON 3</span>
          </div>
        </div>

        {/* Right Tools: Cmd+K & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Quick Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-cyan-400 text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition text-xs font-technical shadow-sm"
          >
            <Search size={14} className="text-cyan-500" />
            <span className="hidden sm:inline">Recherche...</span>
            <kbd className="hidden sm:inline bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-1 py-0.5 rounded text-[10px]">
              Ctrl+K
            </kbd>
          </button>

          {/* Theme Toggle (Clean White vs Deep Space) */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-cyan-400 text-gray-700 dark:text-gray-200 transition shadow-sm"
            title={isDarkMode ? "Passer en mode Clean White" : "Passer en mode Deep Space (Sombre)"}
          >
            {isDarkMode ? (
              <Sun size={17} className="text-amber-400 animate-spin-slow" />
            ) : (
              <Moon size={17} className="text-cyan-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
