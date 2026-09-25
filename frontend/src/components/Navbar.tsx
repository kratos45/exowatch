"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  AlertTriangle,
  Pickaxe,
  Bot,
  Activity,
  FileText,
  Radio,
  Share2,
} from "lucide-react";
import { useHealth } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";

const NAV_ITEMS = [
  { label: "Briefing", href: "/", icon: Radio },
  { label: "Objets Dangereux", href: "/objects", icon: AlertTriangle },
  { label: "Minage ISRU", href: "/mining", icon: Pickaxe },
  { label: "Vue 3D Orbitale", href: "/orbit", icon: Compass },
  { label: "Assistant SQL", href: "/assistant", icon: Bot },
  { label: "Traçabilité", href: "/trace", icon: Share2 },
  { label: "Rapports", href: "/reports", icon: FileText },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: health, isSuccess } = useHealth();
  const { selectedEntityId, selectedName } = useSelectionStore();

  const isHealthy = isSuccess && health?.status === "healthy";

  return (
    <header className="sticky top-0 z-50 border-b border-[#1f2937] bg-[#0A0E14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.25)] transition-all group-hover:scale-105">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono text-base font-bold tracking-wider text-[#E6E9EF]">
                EXOWATCH
                <span className="rounded bg-[#00D9FF]/20 px-1.5 py-0.2 text-[10px] font-mono text-[#00D9FF]">
                  MISSION CONTROL
                </span>
              </div>
              <div className="text-[10px] font-mono text-[#8b949e]">
                Plateforme Décisionnelle NEO
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 font-mono text-xs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
                  isActive
                    ? "border border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF] shadow-[0_0_10px_rgba(0,217,255,0.15)] font-semibold"
                    : "text-[#8b949e] hover:border-transparent hover:bg-[#131820] hover:text-[#E6E9EF]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status indicator & active target */}
        <div className="flex items-center gap-3">
          {selectedEntityId && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-[#00D9FF]/30 bg-[#131820] px-2.5 py-1 text-xs font-mono text-[#00D9FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D9FF] animate-pulse" />
              <span className="truncate max-w-[120px]">
                Cible: {selectedName || selectedEntityId}
              </span>
            </div>
          )}

          {/* API Health badge */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] ${
              isHealthy
                ? "border-[#2ed573]/30 bg-[#2ed573]/10 text-[#2ed573]"
                : "border-[#ff4757]/30 bg-[#ff4757]/10 text-[#ff4757]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isHealthy ? "bg-[#2ed573] animate-pulse" : "bg-[#ff4757]"
              }`}
            />
            <span>{isHealthy ? "API 8000 CONNECTÉE" : "API DÉCONNECTÉE"}</span>
          </div>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="flex lg:hidden overflow-x-auto border-t border-[#1f2937] px-2 py-1.5 font-mono text-xs gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 ${
                isActive
                  ? "bg-[#00D9FF]/15 text-[#00D9FF] font-semibold"
                  : "text-[#8b949e]"
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
