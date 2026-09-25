"use client";

import React from "react";
import { Bot, ShieldCheck, Database } from "lucide-react";
import { ChatWindow } from "@/components/ChatWindow";

export default function AssistantPage() {
  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E9EF] flex items-center gap-2">
          <Bot className="h-6 w-6 text-[#00D9FF]" />
          ASSISTANT CONVERSATIONNEL TEXT-TO-SQL
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Interrogez les tables et vues curées de SQLite en langage naturel sans jamais risquer de corrompre la base.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <ChatWindow />
        </div>

        {/* Security and schema card */}
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#00D9FF]">
              <ShieldCheck className="h-4 w-4" />
              <span>Garanties de Sécurité</span>
            </div>
            <ul className="space-y-2 text-[#8b949e] text-[11px] list-disc pl-4">
              <li>
                <strong className="text-[#E6E9EF]">Connexion URI mode=ro :</strong> Même si le LLM génère une écriture, SQLite la refuse au niveau système C.
              </li>
              <li>
                <strong className="text-[#E6E9EF]">Filtre strict validate_sql() :</strong> Seul le mot-clé <code>SELECT</code> est autorisé. Tout mot <code>DROP</code>, <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code> est rejeté.
              </li>
              <li>
                <strong className="text-[#E6E9EF]">Audit traçable :</strong> Toute requête est consignée dans la table <code>agent_queries</code>.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#1f2937] bg-[#131820] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#2ed573]">
              <Database className="h-4 w-4" />
              <span>Vues Recommandées</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-[#00D9FF] font-semibold">view_hazardous</span>
                <p className="text-[#8b949e]">Astéroïdes dangereux uniquement, triés par distance croissante.</p>
              </div>
              <div>
                <span className="text-[#00D9FF] font-semibold">view_minable</span>
                <p className="text-[#8b949e]">Évaluations d'opportunités minières spatiales ISRU.</p>
              </div>
              <div>
                <span className="text-[#00D9FF] font-semibold">priority_scores</span>
                <p className="text-[#8b949e]">Scores composites d'urgence opérationnelle (0-100).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
