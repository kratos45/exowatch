import { create } from "zustand";

interface SelectionState {
  selectedEntityId: string | null;
  selectedName: string | null;
  suggestedQuestion: string | null;
  setSelectedEntity: (id: string | null, name?: string | null) => void;
  setSuggestedQuestion: (q: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedEntityId: null,
  selectedName: null,
  suggestedQuestion: null,
  setSelectedEntity: (id, name = null) =>
    set({
      selectedEntityId: id,
      selectedName: name,
      suggestedQuestion: id ? `Analyse l'astéroïde ${name || id} : quel est son profil de risque et d'orbite ?` : null,
    }),
  setSuggestedQuestion: (q) => set({ suggestedQuestion: q }),
}));
