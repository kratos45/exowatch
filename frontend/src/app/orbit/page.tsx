"use client";

import React from "react";
import { Compass, Bot, ArrowRight, Shield } from "lucide-react";
import { useAllOrbits } from "@/lib/api";
import { OrbitViewer } from "@/components/OrbitViewer";
import { useSelectionStore } from "@/store/useSelectionStore";
import { useRouter } from "next/navigation";

export default function OrbitPage() {
  const router = useRouter();
  const { data: orbits, isLoading, isError } = useAllOrbits();
  const { selectedEntityId, selectedName, setSelectedEntity, setSuggestedQuestion } =
    useSelectionStore();

  const currentSelection = (orbits || []).find(
    (o: any) => o.entity_id === selectedEntityId
  );

  const handleSelect = (entityId: string) => {
    const item = (orbits || []).find((o: any) => o.entity_id === entityId);
    setSelectedEntity(entityId, item?.name || entityId);
  };

  const handleAskAgent = () => {
    if (!currentSelection) return;
    setSuggestedQuestion(`Décris l'orbite et le périmètre de danger de ${currentSelection.name} (${currentSelection.entity_id}).`);
    router.push("/assistant");
  };

  const handleDetail = () => {
    if (!currentSelection) return;
    router.push(`/objects/${currentSelection.entity_id}`);
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E9EF] flex items-center gap-2">
            <Compass className="h-6 w-6 text-[#00D9FF]" />
            VISUALISATION 3D ORBITALE (MÉCANIQUE KÉPLÉRIENNE)
          </h1>
          <p className="text-xs text-[#8b949e] mt-1">
            Projection 3D héliocentrique des ellipses orbitales calculées à partir des éléments (a, e, i, Ω, ω).
          </p>
        </div>

        {/* Orbit Selector */}
        {orbits && orbits.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8b949e]">Focus Objet :</span>
            <select
              value={selectedEntityId || ""}
              onChange={(e) => handleSelect(e.target.value)}
              className="rounded-lg border border-[#1f2937] bg-[#131820] px-3 py-1.5 text-xs text-[#E6E9EF] focus:border-[#00D9FF] focus:outline-none"
            >
              <option value="">-- Vue d'ensemble du système --</option>
              {orbits.map((o: any) => (
                <option key={o.entity_id} value={o.entity_id}>
                  {o.name} {o.is_hazardous ? "🚨" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      {isLoading ? (
        <div className="flex h-[600px] items-center justify-center rounded-xl border border-[#1f2937] bg-[#0A0E14] text-xs text-[#00D9FF] animate-pulse">
          RÉSOLUTION ANALYTIQUE DES ÉQUATIONS DE KEPLER...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-6 text-center text-xs text-[#ff4757]">
          Erreur lors du chargement des éléments orbitaux.
        </div>
      ) : (
        <div className="space-y-4">
          <OrbitViewer orbits={orbits || []} highlightId={selectedEntityId} />

          {/* Selected object metadata strip */}
          {currentSelection && (
            <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-bold text-[#FFFFFF] text-sm">
                  {currentSelection.name} ({currentSelection.entity_id})
                </div>
                <div className="text-[#8b949e] mt-0.5">
                  Demi-grand axe : <strong>{Number(currentSelection.semi_major_axis || 0).toFixed(3)} UA</strong> •{" "}
                  Excentricité : <strong>{Number(currentSelection.eccentricity || 0).toFixed(4)}</strong> •{" "}
                  Inclinaison : <strong>{Number(currentSelection.inclination || 0).toFixed(2)}°</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAskAgent}
                  className="flex items-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#0A0E14] px-3 py-1.5 text-xs text-[#00D9FF] hover:border-[#00D9FF]"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Interroger l'Assistant</span>
                </button>
                <button
                  onClick={handleDetail}
                  className="flex items-center gap-1.5 rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-3 py-1.5 text-xs text-[#00D9FF] hover:bg-[#00D9FF]/20"
                >
                  <span>Fiche complète</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
