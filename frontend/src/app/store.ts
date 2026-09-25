import { create } from "zustand";

export interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
}

interface ExoWatchState {
  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (val: boolean) => void;

  // Navigation & Selected Target
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedTargetName: string;
  setSelectedTargetName: (name: string) => void;

  // Quick Action / Search Modal (Cmd+K)
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Active Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;

  // System status
  systemStatus: {
    nasaApi: "connected" | "degraded" | "offline";
    neo4jLatencyMs: number;
    activeNEOsCount: number;
    defconLevel: number;
  };
}

export const useExoWatchStore = create<ExoWatchState>((set) => ({
  isDarkMode: false,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setDarkMode: (val) => set({ isDarkMode: val }),

  activeTab: "cockpit",
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedTargetName: "433 Eros (A898 PA)",
  setSelectedTargetName: (name) => set({ selectedTargetName: name }),

  isSearchOpen: false,
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),

  toasts: [
    {
      id: "init-1",
      type: "info",
      title: "Uplink Station Établi",
      message: "Connexion sécurisée au Knowledge Graph Neo4j et aux archives JPL SSD.",
    },
  ],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4500);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  systemStatus: {
    nasaApi: "connected",
    neo4jLatencyMs: 3,
    activeNEOsCount: 2407,
    defconLevel: 3,
  },
}));
