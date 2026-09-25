"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Pickaxe, Filter, ArrowRight, ShieldCheck, DollarSign } from "lucide-react";
import { useMiningList } from "@/lib/api";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import { useSelectionStore } from "@/store/useSelectionStore";
import { useRouter } from "next/navigation";

export default function MiningPage() {
  const router = useRouter();
  const { data: candidates, isLoading, isError } = useMiningList();
  const { setSelectedEntity, setSuggestedQuestion } = useSelectionStore();
  const [filterAssessment, setFilterAssessment] = useState<string>("all");

  const filtered = (candidates || []).filter((item: any) => {
    if (filterAssessment === "all") return true;
    return item.mining_assessment?.toLowerCase() === filterAssessment.toLowerCase();
  });

  const handleInspect = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    router.push(`/objects/${entityId}`);
  };

  const handleAsk = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    setSuggestedQuestion(`Quelle est la rentabilité et le coût delta-V pour exploiter les ressources minières de ${name} (${entityId}) ?`);
    router.push("/assistant");
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E9EF] flex items-center gap-2">
          <Pickaxe className="h-6 w-6 text-[#00D9FF]" />
          CATALOGUE D'EXPLOITATION MINIÈRE SPATIALE (ISRU)
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Évaluation multicritère des astéroïdes pour l'extraction de ressources in-situ (Vue SQL <code className="text-[#00D9FF]">view_minable</code>).
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1f2937] pb-3 text-xs">
        <span className="text-[#8b949e]">Filtrer par potentiel :</span>
        {["all", "high", "medium", "low"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterAssessment(status)}
            className={`rounded-md px-3 py-1 uppercase transition-all ${
              filterAssessment === status
                ? "bg-[#00D9FF]/20 text-[#00D9FF] font-bold border border-[#00D9FF]/40"
                : "text-[#8b949e] hover:text-[#E6E9EF]"
            }`}
          >
            {status === "all" ? "Tous" : status}
          </button>
        ))}
      </div>

      {/* Grid of mining candidates */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-[#00D9FF] animate-pulse">
          CHARGEMENT DES GISEMENTS MINIERS...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-6 text-center text-xs text-[#ff4757]">
          Erreur de connexion à l'API minière.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-12 text-center text-xs text-[#8b949e]">
          Aucun astéroïde minable correspondant aux critères.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item: any) => {
            const assessment = item.mining_assessment?.toLowerCase();
            const badgeColor =
              assessment === "high"
                ? "text-[#2ed573] border-[#2ed573]/30 bg-[#2ed573]/10"
                : assessment === "medium"
                ? "text-[#ffa502] border-[#ffa502]/30 bg-[#ffa502]/10"
                : "text-[#8b949e] border-gray-700 bg-gray-800/40";

            return (
              <div
                key={item.entity_id}
                className="rounded-xl border border-[#1f2937] bg-[#131820] p-5 flex flex-col justify-between transition-all hover:border-[#00D9FF]/40 hover:shadow-[0_0_20px_rgba(0,217,255,0.08)]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-[#FFFFFF] truncate">
                      {item.name}
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-[10px] uppercase font-bold ${badgeColor}`}>
                      {item.mining_assessment || "N/A"}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5">
                    ID : {item.entity_id} • {item.orbit_class || "Apollo"}
                  </div>

                  <div className="my-4 flex items-center justify-around border-y border-[#1f2937] py-3">
                    <div className="text-center">
                      <div className="text-[10px] text-[#8b949e]">Diamètre Max</div>
                      <div className="text-sm font-bold text-[#E6E9EF] mt-0.5">
                        {Number(item.diameter_km_max || 0).toFixed(3)} km
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-[#8b949e]">Vélocité</div>
                      <div className="text-sm font-bold text-[#E6E9EF] mt-0.5">
                        {Math.round(item.velocity_kmh || 0).toLocaleString()} km/h
                      </div>
                    </div>
                    <ConfidenceGauge
                      confidence={item.confidence || 0.8}
                      size={70}
                      label=""
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleAsk(item.entity_id, item.name)}
                    className="flex-1 rounded border border-[#1f2937] bg-[#0A0E14] py-1.5 text-xs text-[#00D9FF] hover:border-[#00D9FF] text-center"
                  >
                    Questionner l'IA
                  </button>
                  <button
                    onClick={() => handleInspect(item.entity_id, item.name)}
                    className="rounded border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-3 py-1.5 text-xs text-[#00D9FF] hover:bg-[#00D9FF]/20"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
