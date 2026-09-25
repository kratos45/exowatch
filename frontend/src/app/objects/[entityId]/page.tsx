"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Bot,
  AlertTriangle,
  Shield,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { useNeoDetail } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";
import { KpiCard } from "@/components/ui/KpiCard";
import { ThreatBadge } from "@/components/ui/ThreatBadge";
import { Sparkline } from "@/components/ui/Sparkline";

export default function ObjectDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const entityId = resolvedParams.entityId;

  const { data: detail, isLoading, isError } = useNeoDetail(entityId);
  const { setSelectedEntity, setSuggestedQuestion } = useSelectionStore();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center font-mono text-sm text-[#00D9FF] animate-pulse">
        CHARGEMENT DE LA TÉLÉMÉTRIE D'ASTÉROÏDE {entityId}...
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-8 text-center font-mono text-xs">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#ff4757] mb-2" />
        <h2 className="text-lg font-bold text-[#E6E9EF]">Astéroïde introuvable</h2>
        <p className="mt-1 text-[#8b949e]">Aucune observation curée pour l'ID : {entityId}</p>
        <Link
          href="/objects"
          className="mt-4 inline-flex items-center gap-1 text-[#00D9FF] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>
      </div>
    );
  }

  const latestObs = detail.latest_observation || {};
  const isHaz = Boolean(latestObs.is_hazardous);
  const score = detail.priority_score ? Math.round(detail.priority_score.score) : 0;
  const anomaly = detail.anomaly_analysis;
  const orbit = detail.orbital_elements;
  const trend = detail.trend_forecast || { history: [score], projected: [score], slope: 0 };
  const enrichments = detail.ai_enrichments || [];

  const handleAsk = () => {
    setSelectedEntity(entityId, detail.name);
    setSuggestedQuestion(`Fais-moi un rapport exhaustif sur ${detail.name} (${entityId}) : risques, minage et dynamique orbitale.`);
    router.push("/assistant");
  };

  const handle3D = () => {
    setSelectedEntity(entityId, detail.name);
    router.push("/orbit");
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/objects"
          className="flex items-center gap-2 text-xs text-[#8b949e] hover:text-[#00D9FF] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à la liste des géocroiseurs</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handle3D}
            className="flex items-center gap-1.5 rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-3 py-1.5 text-xs text-[#00D9FF] hover:bg-[#00D9FF]/20"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Visualiser l'orbite 3D</span>
          </button>
          <button
            onClick={handleAsk}
            className="flex items-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#131820] px-3 py-1.5 text-xs text-[#E6E9EF] hover:border-[#00D9FF]"
          >
            <Bot className="h-3.5 w-3.5 text-[#00D9FF]" />
            <span>Interroger avec le Chat SQL</span>
          </button>
        </div>
      </div>

      {/* Main Header Box */}
      <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2937] pb-6">
          <div>
            <div className="text-xs text-[#8b949e] tracking-wider">FICHE TÉLÉMÉTRIQUE ASTÉROÏDE</div>
            <h1 className="text-3xl font-extrabold text-[#FFFFFF] mt-1">{detail.name}</h1>
            <div className="text-xs text-[#8b949e] mt-1">
              ID NeoWS : <span className="text-[#00D9FF]">{entityId}</span> • Classe :{" "}
              <span className="text-[#E6E9EF]">{latestObs.orbit_class || "Apollo"}</span> • {detail.observations_count} observation(s)
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThreatBadge score={score} isHazardous={isHaz} size="lg" />
          </div>
        </div>

        {/* Core telemetry strip */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Score de Priorité"
            value={`${score}/100`}
            subtitle={`Pente: ${trend.slope > 0 ? `+${trend.slope.toFixed(1)}` : trend.slope.toFixed(1)}`}
            icon={<Shield className="h-5 w-5" />}
          />
          <KpiCard
            label="Diamètre Estimé Max"
            value={`${Number(latestObs.diameter_km_max || 0).toFixed(3)} km`}
            subtitle={`Min: ${Number(latestObs.diameter_km_min || 0).toFixed(3)} km`}
          />
          <KpiCard
            label="Vélocité Relative"
            value={`${Math.round(latestObs.velocity_kmh || 0).toLocaleString()} km/h`}
            subtitle="Vitesse de croisement"
          />
          <KpiCard
            label="Distance au Périgée"
            value={`${Math.round(latestObs.miss_distance_km || 0).toLocaleString()} km`}
            subtitle={`Soit ${(latestObs.miss_distance_km / 384400).toFixed(1)} Distances Lunaires`}
          />
        </div>
      </div>

      {/* Grid: AI Enrichments + Anomaly & Keplerian Orbit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Directives & Enrichments */}
        <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#E6E9EF] border-b border-[#1f2937] pb-3">
            <Sparkles className="h-4 w-4 text-[#00D9FF]" />
            <span>ENRICHISSEMENTS DU MODÈLE IA & RECOMMANDATIONS</span>
          </div>

          {enrichments.length > 0 ? (
            <div className="space-y-3">
              {enrichments.map((enr: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[#8b949e]">
                    <span className="uppercase text-[#00D9FF] font-semibold">{enr.field_enriched}</span>
                    <span>Modèle : {enr.model_used}</span>
                  </div>
                  <div className="text-[#E6E9EF] leading-relaxed pt-1">{enr.value}</div>
                  <div className="text-[10px] text-[#8b949e] pt-1">
                    Confiance : {(enr.confidence * 100).toFixed(0)}% • Version : {enr.prompt_version}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8b949e]">
              Aucun enrichissement IA n'a encore été généré pour cet astéroïde.
            </div>
          )}
        </div>

        {/* Physical & Keplerian Orbit */}
        <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#E6E9EF] border-b border-[#1f2937] pb-3">
            <Compass className="h-4 w-4 text-[#00D9FF]" />
            <span>PARAMÈTRES ORBITAUX KÉPLÉRIENS</span>
          </div>

          {orbit ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-[#1f2937] bg-[#0A0E14] p-2.5">
                <div className="text-[#8b949e]">Demi-grand axe (a)</div>
                <div className="text-base font-bold text-[#FFFFFF] mt-1">
                  {Number(orbit.semi_major_axis || 0).toFixed(3)} UA
                </div>
              </div>

              <div className="rounded border border-[#1f2937] bg-[#0A0E14] p-2.5">
                <div className="text-[#8b949e]">Excentricité (e)</div>
                <div className="text-base font-bold text-[#FFFFFF] mt-1">
                  {Number(orbit.eccentricity || 0).toFixed(4)}
                </div>
              </div>

              <div className="rounded border border-[#1f2937] bg-[#0A0E14] p-2.5">
                <div className="text-[#8b949e]">Inclinaison (i)</div>
                <div className="text-base font-bold text-[#FFFFFF] mt-1">
                  {Number(orbit.inclination || 0).toFixed(2)}°
                </div>
              </div>

              <div className="rounded border border-[#1f2937] bg-[#0A0E14] p-2.5">
                <div className="text-[#8b949e]">Période Orbitale</div>
                <div className="text-base font-bold text-[#FFFFFF] mt-1">
                  {Math.round(orbit.orbital_period_days || 0)} jours
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8b949e]">
              Paramètres orbitaux non disponibles pour cet objet.
            </div>
          )}

          {/* Anomaly ML Evaluation */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#E6E9EF] border-b border-[#1f2937] pb-3">
              <Activity className="h-4 w-4 text-[#00D9FF]" />
              <span>SCORE D'ANOMALIE ISOLATION FOREST</span>
            </div>

            {anomaly ? (
              <div className="mt-3 rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="text-[#8b949e]">Score d'anomalie :</div>
                  <div className="text-lg font-bold text-[#00D9FF]">{Number(anomaly.anomaly_score).toFixed(4)}</div>
                </div>
                <div>
                  {anomaly.is_anomaly ? (
                    <span className="rounded bg-[#ff4757]/20 px-2.5 py-1 text-xs font-bold text-[#ff4757]">
                      🚨 ANOMALIE ML CONFIRMÉE
                    </span>
                  ) : (
                    <span className="rounded bg-[#2ed573]/20 px-2.5 py-1 text-xs font-bold text-[#2ed573]">
                      ✓ Profil Normal
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#8b949e]">
                Aucun score d'anomalie calculé pour le moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
