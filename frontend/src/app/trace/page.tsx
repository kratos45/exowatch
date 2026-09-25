"use client";

import React, { useState } from "react";
import { Share2, Search, CheckCircle, XCircle, ArrowRight, Shield } from "lucide-react";
import { useLineage } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";

export default function TracePage() {
  const { selectedEntityId, selectedName } = useSelectionStore();
  const [searchId, setSearchId] = useState(selectedEntityId || "3542519");
  const [activeQueryId, setActiveQueryId] = useState(searchId);

  const { data: lineage, isLoading } = useLineage(activeQueryId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      setActiveQueryId(searchId.trim());
    }
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E9EF] flex items-center gap-2">
          <Share2 className="h-6 w-6 text-[#00D9FF]" />
          TRAÇABILITÉ & DATA LINEAGE
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Audit de bout en bout de l'ingestion, des validations contractuelles et des enrichissements IA par entité.
        </p>
      </div>

      {/* Entity Query Bar */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8b949e]" />
          <input
            type="text"
            placeholder="Entrez un identifiant NeoWS (ex: 3542519)..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="w-full rounded-lg border border-[#1f2937] bg-[#131820] pl-9 pr-4 py-2 text-xs text-[#E6E9EF] focus:border-[#00D9FF] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-4 py-2 text-xs font-bold text-[#00D9FF] hover:bg-[#00D9FF]/20"
        >
          Tracer la lignée
        </button>
      </form>

      {/* Conceptual Pipeline Stage Flow Diagram */}
      <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#E6E9EF]">
          CYCLE DE VIE & TRANSFORMATION SOUS CONTRAT DE DONNÉES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-center">
            <div className="text-[10px] text-[#8b949e]">ÉTAPE 1</div>
            <div className="font-bold text-[#00D9FF] mt-1">Ingestion Brute</div>
            <div className="text-[10px] text-[#8b949e] mt-1">data/raw/ (JSON verbatim)</div>
          </div>
          <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-center">
            <div className="text-[10px] text-[#8b949e]">ÉTAPE 2</div>
            <div className="font-bold text-[#00D9FF] mt-1">Profilage & Audit</div>
            <div className="text-[10px] text-[#8b949e] mt-1">stats univariées, missing</div>
          </div>
          <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-center">
            <div className="text-[10px] text-[#8b949e]">ÉTAPE 3</div>
            <div className="font-bold text-[#2ed573] mt-1">Validation R1-R6</div>
            <div className="text-[10px] text-[#8b949e] mt-1">Contrat data_contract.yaml</div>
          </div>
          <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-center">
            <div className="text-[10px] text-[#8b949e]">ÉTAPE 4</div>
            <div className="font-bold text-[#00D9FF] mt-1">Stockage Curated</div>
            <div className="text-[10px] text-[#8b949e] mt-1">SQLite néo_curated.db</div>
          </div>
          <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-center">
            <div className="text-[10px] text-[#8b949e]">ÉTAPE 5</div>
            <div className="font-bold text-[#ffa502] mt-1">Enrichissement IA</div>
            <div className="text-[10px] text-[#8b949e] mt-1">ai_enrichments isolé</div>
          </div>
        </div>
      </div>

      {/* Entity specific lineage logs */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-xs text-[#00D9FF] animate-pulse">
          RECONSTITUTION DE L'HISTORIQUE DE TRAÇABILITÉ...
        </div>
      ) : lineage ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Observations log */}
          <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#E6E9EF] flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#2ed573]" />
              <span>Observations Ingestionnées ({lineage.observations?.length || 0})</span>
            </h3>

            {lineage.observations?.length > 0 ? (
              <div className="space-y-3">
                {lineage.observations.map((obs: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-xs space-y-1">
                    <div className="flex justify-between text-[#FFFFFF] font-bold">
                      <span>{obs.name}</span>
                      <span className="text-[#8b949e]">{obs.observed_at}</span>
                    </div>
                    <div className="text-[11px] text-[#8b949e]">
                      Fichier source : <code className="text-[#00D9FF]">{obs.source_raw_file}</code>
                    </div>
                    <div className="text-[11px] text-[#8b949e]">
                      Horodatage chargement : {obs.loaded_at}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8b949e]">
                Aucune observation trouvée pour cette entité.
              </div>
            )}
          </div>

          {/* AI enrichments & rejection history */}
          <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#E6E9EF] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#00D9FF]" />
              <span>Enrichissements & Audits Qualité</span>
            </h3>

            {lineage.ai_enrichments?.length > 0 ? (
              <div className="space-y-3">
                {lineage.ai_enrichments.map((enr: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-xs space-y-1">
                    <div className="flex justify-between text-[#00D9FF] font-semibold">
                      <span className="uppercase">{enr.field_enriched}</span>
                      <span className="text-[#8b949e]">{enr.enriched_at}</span>
                    </div>
                    <div className="text-[#E6E9EF]">{enr.value}</div>
                    <div className="text-[10px] text-[#8b949e]">
                      Run lié : {enr.pipeline_run_id} • Modèle : {enr.model_used}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8b949e]">
                Aucun enrichissement IA associé à cet astéroïde.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
