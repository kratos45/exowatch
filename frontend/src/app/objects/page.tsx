"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, AlertTriangle, ShieldCheck, Compass, Bot, ArrowRight } from "lucide-react";
import { useNeoList } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";
import { ThreatBadge } from "@/components/ui/ThreatBadge";

export default function ObjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hazardousOnly, setHazardousOnly] = useState(false);
  const [showAtypicalOnly, setShowAtypicalOnly] = useState(false);

  const { data: objects, isLoading, isError } = useNeoList({
    hazardousOnly,
    search: search.trim() || undefined,
  });

  const { setSelectedEntity, setSuggestedQuestion } = useSelectionStore();

  const handleSelectObject = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    router.push(`/objects/${entityId}`);
  };

  const handleOrbitView = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    router.push("/orbit");
  };

  const handleAskAgent = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    setSuggestedQuestion(`Donne-moi l'évaluation de risque et les détails orbitaux de ${name} (${entityId}).`);
    router.push("/assistant");
  };

  const filteredObjects = (objects || []).filter((item: any) => {
    if (showAtypicalOnly) {
      return item.is_anomaly === 1 || item.anomaly_score < 0;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-[#E6E9EF] flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-[#ff4757]" />
          SURVEILLANCE DES OBJETS GÉOCROISEURS (NEO)
        </h1>
        <p className="text-xs text-[#8b949e] font-mono mt-1">
          Inventaire sous contrat de données des corps célestes surveillés par ExoWatch.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-[#1f2937] bg-[#131820] p-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8b949e]" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1f2937] bg-[#0A0E14] pl-9 pr-4 py-2 font-mono text-xs text-[#E6E9EF] placeholder-[#8b949e] focus:border-[#00D9FF] focus:outline-none"
          />
        </div>

        {/* Toggle Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-mono text-xs">
          <button
            onClick={() => setHazardousOnly(!hazardousOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-all ${
              hazardousOnly
                ? "border-[#ff4757] bg-[#ff4757]/20 text-[#ff4757] font-bold"
                : "border-[#1f2937] bg-[#0A0E14] text-[#8b949e] hover:text-[#E6E9EF]"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Dangereux uniquement (PHA)</span>
          </button>

          <button
            onClick={() => setShowAtypicalOnly(!showAtypicalOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-all ${
              showAtypicalOnly
                ? "border-[#00D9FF] bg-[#00D9FF]/20 text-[#00D9FF] font-bold"
                : "border-[#1f2937] bg-[#0A0E14] text-[#8b949e] hover:text-[#E6E9EF]"
            }`}
          >
            <span>Anomalies ML uniquement</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center font-mono text-xs text-[#00D9FF] animate-pulse">
          CHARGEMENT DES DONNÉES CURÉES...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-6 text-center text-xs font-mono text-[#ff4757]">
          Erreur lors du chargement des objets.
        </div>
      ) : filteredObjects.length === 0 ? (
        <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-12 text-center text-xs font-mono text-[#8b949e]">
          Aucun objet ne correspond à vos critères de recherche.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1f2937] bg-[#131820]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1f2937] bg-[#0A0E14] text-[#8b949e] uppercase">
              <tr>
                <th className="px-4 py-3">Astéroïde</th>
                <th className="px-4 py-3">Date Approche</th>
                <th className="px-4 py-3">Statut Menace</th>
                <th className="px-4 py-3">Score Priorité</th>
                <th className="px-4 py-3">Diamètre Max</th>
                <th className="px-4 py-3">Vélocité</th>
                <th className="px-4 py-3">Distance Manquée</th>
                <th className="px-4 py-3">Score ML</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {filteredObjects.map((item: any) => {
                const isHaz = Boolean(item.is_hazardous);
                const score = item.priority_score ? Math.round(item.priority_score) : null;
                const lunarDist = (item.miss_distance_km / 384400).toFixed(1);

                return (
                  <tr
                    key={item.observation_id || item.entity_id}
                    className="hover:bg-[#1f2937]/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-[#FFFFFF]">
                      <button
                        onClick={() => handleSelectObject(item.entity_id, item.name)}
                        className="hover:text-[#00D9FF] hover:underline text-left"
                      >
                        {item.name}
                      </button>
                      <span className="block text-[10px] text-[#8b949e]">
                        {item.entity_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8b949e]">{item.observed_at}</td>
                    <td className="px-4 py-3">
                      <ThreatBadge isHazardous={isHaz} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      {score !== null ? (
                        <span className="font-bold text-[#00D9FF]">{score} / 100</span>
                      ) : (
                        <span className="text-[#8b949e]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#E6E9EF]">
                      {Number(item.diameter_km_max || 0).toFixed(3)} km
                    </td>
                    <td className="px-4 py-3 text-[#E6E9EF]">
                      {Math.round(item.velocity_kmh || 0).toLocaleString()} km/h
                    </td>
                    <td className="px-4 py-3 text-[#E6E9EF]">
                      <div>{Math.round(item.miss_distance_km || 0).toLocaleString()} km</div>
                      <div className="text-[10px] text-[#8b949e]">{lunarDist} LD</div>
                    </td>
                    <td className="px-4 py-3">
                      {item.anomaly_score !== undefined && item.anomaly_score !== null ? (
                        <span
                          className={`font-semibold ${
                            item.is_anomaly ? "text-[#ff4757]" : "text-[#8b949e]"
                          }`}
                        >
                          {Number(item.anomaly_score).toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[#8b949e]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="Visualiser l'orbite 3D"
                          onClick={() => handleOrbitView(item.entity_id, item.name)}
                          className="rounded p-1.5 text-[#8b949e] hover:bg-[#0A0E14] hover:text-[#00D9FF]"
                        >
                          <Compass className="h-4 w-4" />
                        </button>
                        <button
                          title="Poser une question à l'assistant"
                          onClick={() => handleAskAgent(item.entity_id, item.name)}
                          className="rounded p-1.5 text-[#8b949e] hover:bg-[#0A0E14] hover:text-[#00D9FF]"
                        >
                          <Bot className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSelectObject(item.entity_id, item.name)}
                          className="flex items-center gap-1 rounded border border-[#1f2937] bg-[#0A0E14] px-2 py-1 text-[11px] text-[#E6E9EF] hover:border-[#00D9FF]"
                        >
                          <span>Fiche</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
