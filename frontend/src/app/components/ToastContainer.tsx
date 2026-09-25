"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExoWatchStore } from "../store";
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useExoWatchStore();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "danger":
        return <AlertOctagon className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-cyan-500" />;
    }
  };

  const getBorder = (type: string) => {
    switch (type) {
      case "success":
        return "border-emerald-300 dark:border-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
      case "warning":
        return "border-amber-300 dark:border-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
      case "danger":
        return "border-red-400 dark:border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.3)]";
      default:
        return "border-cyan-300 dark:border-cyan-700 shadow-[0_0_15px_rgba(6,182,212,0.2)]";
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto p-3.5 rounded-xl border bg-white/95 dark:bg-slate-900/95 backdrop-blur-md ${getBorder(
              toast.type
            )} flex items-start gap-3`}
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 pr-2">
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{toast.title}</div>
              <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
