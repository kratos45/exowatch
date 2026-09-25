"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  AlertTriangle,
  Bot,
  Pickaxe,
  Activity,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useBriefing } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";
import { KpiCard } from "@/components/ui/KpiCard";
import { ThreatBadge } from "@/components/ui/ThreatBadge";
import { Sparkline } from "@/components/ui/Sparkline";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";

export default function BriefingPage() {
  const router = useRouter();
  const { data: briefing, isLoading, isError } = useBriefing();
  const { setSelectedEntity, setSuggestedQuestion } = useSelectionStore();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center flex-col gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00D9FF] border-t-transparent shadow-[0_0_20px_rgba(0,217,255,0.3)]" />
        <div className="font-mono text-sm text-[#00D9FF] tracking-wider animate-pulse">
          INITIALISATION MISSION CONTROL... TÉLÉMÉTRIE EN COURS
        </div>
      </div>
    );
  }

  if (isError || !briefing) {
    return (
      <div className="rounded-xl border border-[#ff4757]/40 bg-[#ff4757]/10 p-8 text-center font-mono">
        <AlertTriangle className="mx-auto h-12 w-12 text-[#ff4757] mb-3" />
        <h2 className="text-xl font-bold text-[#E6E9EF]">
          Impossible de contacter le backend ExoWatch
        </h2>
        <p className="mt-2 text-sm text-[#8b949e]">
          Assurez-vous que l'API FastAPI est lancée sur le port 8000 :{" "}
          <code className="text-[#00D9FF]">uvicorn api.main:app --port 8000</code>
        </p>
      </div>
    );
  }

  const latestRun = briefing.latest_run;
  const topPriorities = briefing.top_priorities || [];
  const miningHighlight = briefing.mining_highlight;
  const atypicalObjects = briefing.atypical_objects || [];
  const changeAlerts = briefing.change_alerts || [];

  const handleInspectEntity = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    router.push(`/objects/${entityId}`);
  };

  const handleAskAbout = (entityId: string, name: string) => {
    setSelectedEntity(entityId, name);
    setSuggestedQuestion(`Analyse la menace et l'orbite de l'astéroïde ${name} (${entityId}).`);
    router.push("/assistant");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Mission Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f2937] bg-gradient-to-r from-[#131820] via-[#0d1117] to-[#131820] p-6 lg:p-8 shadow-[0_0_30px_rgba(0,217,255,0.06)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#00D9FF]">
              <span className="h-2 w-2 rounded-full bg-[#00D9FF] animate-pulse" />
              Surveillance Opérationnelle Temps Réel
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-extrabold text-[#E6E9EF] font-mono">
              BRIEFING DE MISSION DU JOUR
            </h1>
            <p className="mt-1 text-xs lg:text-sm text-[#8b949e]">
              Dernier run batch :{" "}
              <span className="font-mono text-[#E6E9EF]">
                {latestRun?.run_id ? latestRun.run_id.slice(0, 8) : "N/A"}
              </span>{" "}
              — Statut qualité :{" "}
              <span className="font-mono text-[#2ed573] font-bold">CONFORME</span>{" "}
              ({latestRun?.accepted_rows || 0} observations validées)
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {latestRun?.run_id && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/reports/${latestRun.run_id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-4 py-2.5 font-mono text-xs font-semibold text-[#00D9FF] transition-all hover:bg-[#00D9FF]/20 hover:shadow-[0_0_15px_rgba(0,217,255,0.25)]"
              >
                <Download className="h-4 w-4" />
                <span>EXPORTER BRIEF PDF</span>
              </a>
            )}
          </div>
        </div>

        {/* Global KPI Strip */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Objets Prioritaires"
            value={topPriorities.length}
            subtitle="Top menaces sous focus"
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <KpiCard
            label="Alertes Actives"
            value={changeAlerts.length}
            subtitle="Variations entre batchs"
            delta={changeAlerts.length > 0 ? "ATTENTION" : "STABLE"}
            deltaType={changeAlerts.length > 0 ? "negative" : "positive"}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <KpiCard
            label="Anomalies ML"
            value={atypicalObjects.length}
            subtitle="Isolation Forest (5% contam)"
            icon={<Activity className="h-5 w-5" />}
          />
          <KpiCard
            label="Opportunités ISRU"
            value={miningHighlight ? "1 QUALIFIÉE" : "0"}
            subtitle="Candidat minier détecté"
            icon={<Pickaxe className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* SECTION 1: TOP 3 PRIORITAIRES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-mono text-[#E6E9EF] flex items-center gap-2">
              <span className="text-[#00D9FF]">01.</span> TOP 3 MENACES & PRIORITÉS D'INTERVENTION
            </h2>
            <p className="text-xs text-[#8b949e]">
              Score composite combinant proximité périgée, vélocité relative, magnitude et tendance
            </p>
          </div>
          <Link
            href="/objects"
            className="flex items-center gap-1 font-mono text-xs text-[#00D9FF] hover:underline"
          >
            <span>Voir tous les objets</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {topPriorities.map((item: any, idx: number) => {
            const score = Math.round(item.score || 0);
            const trend = item.trend_forecast || { history: [score], projected: [score], slope: 0 };
            const lunarDist = (item.miss_distance_km / 384400).toFixed(1);

            return (
              <div
                key={item.entity_id}
                className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 transition-all hover:border-[#00D9FF]/40 hover:shadow-[0_0_20px_rgba(0,217,255,0.08)]"
              >
                {/* Header item */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1f2937] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00D9FF]/10 font-mono text-xs font-bold text-[#00D9FF]">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-[#FFFFFF]">
                          {item.name}
                        </span>
                        <span className="font-mono text-xs text-[#8b949e]">
                          ({item.entity_id})
                        </span>
                      </div>
                      <div className="text-xs text-[#8b949e] font-mono">
                        Classe: {item.orbit_class || "Apollo"} • Approche: {item.observed_at}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <ThreatBadge score={score} isHazardous={Boolean(item.is_hazardous)} />
                    <button
                      onClick={() => handleAskAbout(item.entity_id, item.name)}
                      className="flex items-center gap-1 rounded-md border border-[#1f2937] bg-[#0A0E14] px-2.5 py-1 text-xs font-mono text-[#00D9FF] hover:border-[#00D9FF]"
                    >
                      <Bot className="h-3 w-3" />
                      <span>Interroger</span>
                    </button>
                    <button
                      onClick={() => handleInspectEntity(item.entity_id, item.name)}
                      className="flex items-center gap-1 rounded-md border border-[#1f2937] bg-[#0A0E14] px-2.5 py-1 text-xs font-mono text-[#E6E9EF] hover:border-[#00D9FF]"
                    >
                      <span>Fiche</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* AI Executive Directive */}
                <div className="my-4 rounded-lg border-l-2 border-[#00D9FF] bg-[#00D9FF]/5 p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#8b949e]">
                    Directive IA Synthétisée :
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#E6E9EF] leading-relaxed">
                    {item.ai_summary}
                  </div>
                </div>

                {/* Metrics & Sparkline Forecast */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                  <div>
                    <div className="text-[11px] font-mono text-[#8b949e]">
                      SCORE DE PRIORITÉ
                    </div>
                    <div className="text-2xl font-bold font-mono text-[#00D9FF]">
                      {score}
                      <span className="text-xs text-[#8b949e]"> / 100</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#00D9FF] to-[#ff4757]"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono text-[#8b949e]">
                      DISTANCE AU PÉRIGÉE
                    </div>
                    <div className="text-lg font-bold font-mono text-[#E6E9EF]">
                      {Number(item.miss_distance_km || 0).toLocaleString()} km
                    </div>
                    <div className="text-xs text-[#8b949e] font-mono">
                      Soit <strong className="text-[#00D9FF]">{lunarDist}</strong> Distances Terre-Lune
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono text-[#8b949e]">
                      VÉLOCITÉ & TAILLE
                    </div>
                    <div className="text-lg font-bold font-mono text-[#E6E9EF]">
                      {Math.round(item.velocity_kmh || 0).toLocaleString()} km/h
                    </div>
                    <div className="text-xs text-[#8b949e] font-mono">
                      Diamètre max: {Number(item.diameter_km_max || 0).toFixed(3)} km
                    </div>
                  </div>

                  {/* Sparkline & Trend Forecast */}
                  <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8b949e] mb-1">
                      <span>Tendance & Projection</span>
                      <span className="text-[#00D9FF]">
                        Pente: {trend.slope > 0 ? `+${trend.slope.toFixed(1)}` : trend.slope.toFixed(1)}
                      </span>
                    </div>
                    <Sparkline
                      history={trend.history || [score]}
                      projected={trend.projected || [score]}
                      color={score >= 70 ? "#ff4757" : "#00D9FF"}
                      height={45}
                    />
                    <div className="text-[10px] text-right font-mono text-[#8b949e] mt-1">
                      Est. prochain: <strong>{trend.next_value_estimate?.toFixed(1) || score}</strong> pts
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2 & 3: CHANGE ALERTS & MINING HIGHLIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change alerts */}
        <section className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-base font-bold text-[#E6E9EF] flex items-center gap-2">
              <span className="text-[#00D9FF]">02.</span> ALERTES DE CHANGEMENT RÉCENTES
            </h2>
            <span className="rounded bg-[#ff4757]/15 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#ff4757]">
              {changeAlerts.length} DÉTECTÉES
            </span>
          </div>

          <div className="space-y-3">
            {changeAlerts.length > 0 ? (
              changeAlerts.map((chg: any, i: number) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#FFFFFF]">
                      {chg.name} ({chg.entity_id})
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        chg.change_type.includes("HAUSSE") || chg.change_type.includes("ALERTE")
                          ? "text-[#ff4757]"
                          : "text-[#2ed573]"
                      }`}
                    >
                      {chg.change_type} ({chg.delta_score > 0 ? `+${chg.delta_score.toFixed(1)}` : chg.delta_score.toFixed(1)} pts)
                    </span>
                  </div>
                  <div className="text-xs text-[#8b949e]">{chg.description}</div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs font-mono text-[#8b949e]">
                Aucune fluctuation critique de score observée entre les batchs récents.
              </div>
            )}
          </div>
        </section>

        {/* Mining highlight */}
        <section className="rounded-xl border border-[#1f2937] bg-[#131820] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-base font-bold text-[#E6E9EF] flex items-center gap-2">
              <span className="text-[#00D9FF]">03.</span> OPPORTUNITÉ MINIÈRE DU JOUR (ISRU)
            </h2>
            <Link
              href="/mining"
              className="font-mono text-xs text-[#00D9FF] hover:underline"
            >
              Catalogue complet →
            </Link>
          </div>

          {miningHighlight ? (
            <div className="rounded-lg border border-[#1f2937] bg-[#0A0E14] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="font-mono text-lg font-bold text-[#FFFFFF]">
                  {miningHighlight.name}
                </div>
                <div className="text-xs text-[#8b949e] font-mono">
                  Potentiel :{" "}
                  <span className="text-[#00D9FF] font-bold uppercase">
                    {miningHighlight.mining_assessment}
                  </span>{" "}
                  • Classe: {miningHighlight.orbit_class || "Apollo"}
                </div>
                <div className="text-xs text-[#8b949e] font-mono">
                  Diamètre max :{" "}
                  <strong className="text-[#E6E9EF]">
                    {Number(miningHighlight.diameter_km_max || 0).toFixed(3)} km
                  </strong>
                </div>
                <div className="text-xs text-[#8b949e] font-mono">
                  Vitesse relative :{" "}
                  <strong className="text-[#E6E9EF]">
                    {Math.round(miningHighlight.velocity_kmh || 0).toLocaleString()} km/h
                  </strong>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => handleInspectEntity(miningHighlight.entity_id, miningHighlight.name)}
                    className="rounded border border-[#00D9FF]/40 bg-[#00D9FF]/10 px-3 py-1 text-xs font-mono text-[#00D9FF] hover:bg-[#00D9FF]/20"
                  >
                    Examiner faisabilité
                  </button>
                </div>
              </div>

              <ConfidenceGauge
                confidence={miningHighlight.confidence || 0.85}
                label="Confiance ISRU"
              />
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-[#8b949e]">
              Aucun candidat minier hautement qualifié aujourd'hui.
            </div>
          )}
        </section>
      </div>

      {/* SECTION 4: ATYPICAL OBJECTS (ISOLATION FOREST) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold font-mono text-[#E6E9EF] flex items-center gap-2">
            <span className="text-[#00D9FF]">04.</span> OBJETS ATYPIQUES DÉTECTÉS (ISOLATION FOREST ML)
          </h2>
          <p className="text-xs text-[#8b949e]">
            Objets dont la relation taille/vitesse/magnitude diverge de la distribution normale (contamination=0.05)
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1f2937] bg-[#131820]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1f2937] bg-[#0A0E14] text-[#8b949e] uppercase">
              <tr>
                <th className="px-4 py-3">Astéroïde</th>
                <th className="px-4 py-3">Score ML</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Diamètre Max</th>
                <th className="px-4 py-3">Vélocité</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {atypicalObjects.map((item: any) => (
                <tr key={item.entity_id} className="hover:bg-[#1f2937]/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#FFFFFF]">
                    {item.name}
                    <span className="block text-[10px] text-[#8b949e]">
                      {item.entity_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#00D9FF] font-semibold">
                    {Number(item.anomaly_score || 0).toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    {item.is_anomaly ? (
                      <span className="rounded bg-[#ff4757]/20 px-2 py-0.5 text-[10px] font-bold text-[#ff4757]">
                        🚨 ANOMALIE ML
                      </span>
                    ) : (
                      <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
                        Divergence
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#E6E9EF]">
                    {Number(item.diameter_km_max || 0).toFixed(3)} km
                  </td>
                  <td className="px-4 py-3 text-[#E6E9EF]">
                    {Math.round(item.velocity_kmh || 0).toLocaleString()} km/h
                  </td>
                  <td className="px-4 py-3 text-[#E6E9EF]">
                    {Math.round(item.miss_distance_km || 0).toLocaleString()} km
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleInspectEntity(item.entity_id, item.name)}
                      className="rounded border border-[#1f2937] bg-[#0A0E14] px-2 py-1 text-[11px] text-[#00D9FF] hover:border-[#00D9FF]"
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
