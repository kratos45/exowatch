"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Code2, AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { useAgentQuery } from "@/lib/api";
import { useSelectionStore } from "@/store/useSelectionStore";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  sql?: string;
  isValid?: boolean;
  rowCount?: number;
  data?: any[];
  timestamp: string;
}

const QUICK_QUESTIONS = [
  "Quels objets ont un score de priorité > 80 ?",
  "Compare les objets dangereux par distance",
  "Quels astéroïdes ont le meilleur potentiel minier ?",
  "Combien d'objets sont classés dangereux ?",
];

export function ChatWindow() {
  const { suggestedQuestion, setSuggestedQuestion } = useSelectionStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "Bonjour ! Je suis l'assistant conversationnel ExoWatch. Je traduis vos questions en requêtes SQL SQLite sécurisées (mode lecture seule) et analyse la base neo_curated.db.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agentMutation = useAgentQuery();

  // Pick up suggested questions from store
  useEffect(() => {
    if (suggestedQuestion) {
      setInput(suggestedQuestion);
    }
  }, [suggestedQuestion]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentMutation.isPending]);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || agentMutation.isPending) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSuggestedQuestion(null);

    agentMutation.mutate(query, {
      onSuccess: (res) => {
        const agentMsg: Message = {
          id: Math.random().toString(),
          sender: "agent",
          text: res.answer,
          sql: res.sql,
          isValid: res.is_valid,
          rowCount: res.row_count,
          data: res.data,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      },
      onError: (err: any) => {
        const agentMsg: Message = {
          id: Math.random().toString(),
          sender: "agent",
          text: `Erreur lors de l'exécution de la requête : ${err?.response?.data?.detail || err.message}`,
          isValid: false,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      },
    });
  };

  return (
    <div className="flex h-[720px] flex-col rounded-xl border border-[#1f2937] bg-[#131820] font-mono text-xs overflow-hidden shadow-[0_0_30px_rgba(0,217,255,0.06)]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[#1f2937] bg-[#0A0E14] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D9FF]/10 text-[#00D9FF]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-[#FFFFFF]">Assistant Text-to-SQL ExoWatch</div>
            <div className="text-[10px] text-[#8b949e]">Sécurisé • SELECT lecture seule garanti URI mode=ro</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[#2ed573] bg-[#2ed573]/10 border border-[#2ed573]/30 px-2 py-0.5 rounded">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2ed573] animate-pulse" />
          Audit table agent_queries actif
        </div>
      </div>

      {/* Suggested prompts strip */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#1f2937] bg-[#0A0E14]/60 px-4 py-2">
        <span className="flex items-center gap-1 text-[10px] text-[#8b949e] shrink-0">
          <Sparkles className="h-3 w-3 text-[#00D9FF]" />
          Suggestions :
        </span>
        {QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="shrink-0 rounded-full border border-[#1f2937] bg-[#131820] px-3 py-1 text-[10px] text-[#E6E9EF] hover:border-[#00D9FF] hover:text-[#00D9FF] transition-all"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00D9FF]/10 text-[#00D9FF]">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-4 space-y-2.5 ${
                  isUser
                    ? "bg-[#00D9FF]/15 border border-[#00D9FF]/40 text-[#E6E9EF]"
                    : "bg-[#0A0E14] border border-[#1f2937] text-[#E6E9EF]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
                  <span className="font-bold">{isUser ? "Opérateur" : "Assistant ExoWatch"}</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>

                {/* SQL inspection collapsible */}
                {msg.sql && (
                  <details className="mt-2 rounded-lg border border-[#1f2937] bg-[#131820] p-2.5 text-[11px]">
                    <summary className="cursor-pointer font-bold text-[#00D9FF] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5" />
                        <span>Voir la requête SQL exécutée</span>
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          msg.isValid
                            ? "bg-[#2ed573]/20 text-[#2ed573]"
                            : "bg-[#ff4757]/20 text-[#ff4757]"
                        }`}
                      >
                        {msg.isValid ? `✓ Validé (${msg.rowCount} lignes)` : "✗ Rejeté"}
                      </span>
                    </summary>
                    <div className="mt-2 rounded bg-[#0A0E14] p-2 text-[#00D9FF] overflow-x-auto">
                      <code>{msg.sql}</code>
                    </div>
                  </details>
                )}
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[#8b949e]">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {agentMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-[#00D9FF] animate-pulse">
            <Bot className="h-4 w-4" />
            <span>Génération de la requête SQL et exécution sécurisée...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="border-t border-[#1f2937] bg-[#0A0E14] p-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Posez une question en langage naturel (ex: Quels sont les 5 objets les plus rapides ?)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={agentMutation.isPending}
            className="flex-1 rounded-lg border border-[#1f2937] bg-[#131820] px-4 py-2.5 text-xs text-[#E6E9EF] placeholder-[#8b949e] focus:border-[#00D9FF] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || agentMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[#00D9FF]/40 bg-[#00D9FF]/15 px-4 py-2.5 text-xs font-bold text-[#00D9FF] hover:bg-[#00D9FF]/25 disabled:opacity-50 transition-all"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Envoyer</span>
          </button>
        </form>
      </div>
    </div>
  );
}
