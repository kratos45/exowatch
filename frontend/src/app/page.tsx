"use client";

import React, { useEffect, useState } from "react";
import { useExoWatchStore } from "./store";
import axios from "axios";

// Signature Views
import DashboardCockpitView from "./components/DashboardCockpitView";
import LivingSolarSystem3D from "./components/LivingSolarSystem3D";
import GraphAnalyticsView from "./components/GraphAnalyticsView";
import AsteroidDetailSheet from "./components/AsteroidDetailSheet";
import MultiObjectiveMiningView from "./components/MultiObjectiveMiningView";
import ImpactSimulatorView from "./components/ImpactSimulatorView";
import MultiStepAgentView from "./components/MultiStepAgentView";
import ThreatTimelineView from "./components/ThreatTimelineView";
import MissionControlLiveView from "./components/MissionControlLiveView";
import ThreatHunterGamification from "./components/ThreatHunterGamification";
import ContextualSidebar from "./components/ContextualSidebar";

// Icons
import {
  LayoutDashboard,
  Compass,
  Share2,
  FileSpreadsheet,
  Pickaxe,
  AlertTriangle,
  Bot,
  Clock,
  Terminal,
  Award,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const NAV_TABS = [
  { id: "cockpit", label: "Dashboard", icon: LayoutDashboard },
  { id: "solar", label: "Vue 3D Système", icon: Compass },
  { id: "graph", label: "Graphe 2D (Neo4j)", icon: Share2 },
  { id: "detail", label: "Fiche Astéroïde", icon: FileSpreadsheet },
  { id: "mining", label: "Minage & Routage", icon: Pickaxe },
  { id: "impact", label: "Impact Simulator", icon: AlertTriangle },
  { id: "agent", label: "Agent IA & Dossiers", icon: Bot },
  { id: "timeline", label: "Timeline Menace", icon: Clock },
  { id: "mission_control", label: "Mission Control", icon: Terminal },
  { id: "gamification", label: "Chasseur de Menaces", icon: Award },
];

export default function Home() {
  const { activeTab, setActiveTab, selectedTargetName, setSelectedTargetName } = useExoWatchStore();
  const [solarData, setSolarData] = useState<{ planets: any[]; asteroids: any[] }>({ planets: [], asteroids: [] });

  // Fetch solar system Kepler parameters on load
  useEffect(() => {
    axios.get(`${API_URL}/solar-system`).then((res) => {
      setSolarData(res.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Cockpit Mode Selector / Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-cyan-400/30 dark:border-slate-800 pb-2 overflow-x-auto custom-scrollbar flex-shrink-0">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-technical font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive
                  ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.35)] scale-[1.02] z-10"
                  : "bg-white/60 dark:bg-slate-900/60 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-800 hover:text-cyan-600"
              }`}
            >
              <Icon size={15} className={isActive ? "text-cyan-600 dark:text-cyan-400" : "text-gray-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Multi-Panel Workspace (Main Content View + Contextual Permanent Sidebar) */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Main Content View (Flexible Width) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pr-1 custom-scrollbar">
          {activeTab === "cockpit" && <DashboardCockpitView />}
          {activeTab === "solar" && (
            <div className="h-full min-h-[550px]">
              <LivingSolarSystem3D
                data={solarData}
                onSelectObject={(obj) => setSelectedTargetName(obj.name)}
                selectedObjectName={selectedTargetName}
              />
            </div>
          )}
          {activeTab === "graph" && <GraphAnalyticsView />}
          {activeTab === "detail" && <AsteroidDetailSheet />}
          {activeTab === "mining" && <MultiObjectiveMiningView />}
          {activeTab === "impact" && <ImpactSimulatorView selectedTarget={selectedTargetName} />}
          {activeTab === "agent" && <MultiStepAgentView />}
          {activeTab === "timeline" && (
            <ThreatTimelineView onSelectAsteroid={(name) => setSelectedTargetName(name)} />
          )}
          {activeTab === "mission_control" && <MissionControlLiveView />}
          {activeTab === "gamification" && <ThreatHunterGamification />}
        </div>

        {/* Permanent Contextual Right Sidebar (340px) */}
        <div className="w-[340px] flex-shrink-0 hidden xl:flex flex-col min-h-0">
          <ContextualSidebar />
        </div>
      </div>
    </div>
  );
}
