import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Relationship {
  source: string;
  target: string;
  type: string; // Flexible relationship type from LLM
  description: string;
}

interface RelationshipStore {
  relationships: Relationship[];
  setRelationships: (relationships: Relationship[]) => void;
  clearRelationships: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useRelationshipStore = create<RelationshipStore>()(
  persist(
    (set) => ({
      relationships: [],
      isLoading: false,
      setRelationships: (relationships) => set({ relationships }),
      clearRelationships: () => set({ relationships: [] }),
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "relationship-storage",
    },
  ),
);
