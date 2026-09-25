"use client";

import React from "react";
import { FileText, Download, CheckCircle, Clock, AlertTriangle, Layers } from "lucide-react";
import { useReports } from "@/lib/api";

export default function ReportsPage() {
  const { data: runs, isLoading, isError } = useReports();

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E9EF] flex items-center gap-2">
          <FileText className="h-6 w-6 text-[#00D9FF]" />
          OBSERVABILITÉ DU PIPELINE & RAPPORTS DE MISSION
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Historique d'exécution des batchs d'ingestion sous contrat et téléchargement des rapports PDF exécutifs.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-[#00D9FF] animate-pulse">
          CHARGEMENT DES RAPPORTS D'EXÉCUTION...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-6 text-center text-xs text-[#ff4757]">
          Erreur lors du chargement des rapports.
        </div>
      ) : (
        <div className="space-y-4">
          {(runs || []).map((run: any) => {
            const isPassed = run.quality_status === "PASSED";

            return (
              <div
                key={run.run_id}
                className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#00D9FF]/40"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-[#FFFFFF]">
                      Run #{run.run_id.slice(0, 8)}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        isPassed
                          ? "bg-[#2ed573]/20 text-[#2ed573] border border-[#2ed573]/40"
                          : "bg-[#ff4757]/20 text-[#ff4757] border border-[#ff4757]/40"
                      }`}
                    >
                      {run.quality_status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#8b949e]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#00D9FF]" />
                      Exécuté le : {run.executed_at}
                    </span>
                    <span>•</span>
                    <span>Durée : {Number(run.duration_seconds || 0).toFixed(2)}s</span>
                    <span>•</span>
                    <span>Fichier source : <code className="text-[#E6E9EF]">{run.source_file}</code></span>
                  </div>

                  <div className="flex items-center gap-6 pt-1 text-xs">
                    <div>
                      <span className="text-[#8b949e]">Lignes en entrée : </span>
                      <strong className="text-[#E6E9EF]">{run.input_rows}</strong>
                    </div>
                    <div>
                      <span className="text-[#8b949e]">Acceptées : </span>
                      <strong className="text-[#2ed573]">{run.accepted_rows}</strong>
                    </div>
                    <div>
                      <span className="text-[#8b949e]">Rejetées : </span>
                      <strong className="text-[#ff4757]">{run.rejected_rows}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/reports/${run.run_id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-4 py-2 text-xs font-bold text-[#00D9FF] hover:bg-[#00D9FF]/20 hover:shadow-[0_0_15px_rgba(0,217,255,0.25)] transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>TÉLÉCHARGER LE BRIEF PDF</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
