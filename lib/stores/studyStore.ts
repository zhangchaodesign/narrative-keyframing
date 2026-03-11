import { create } from "zustand";
import { persist } from "zustand/middleware";

type StudyState = {
  user: string;
  task: string;
  ifTracking: boolean;
  setUser: (user: string) => void;
  setTask: (task: string) => void;
  setIfTracking: (ifTracking: boolean) => void;
};

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      user: "annonymous",
      task: "",
      ifTracking: false,
      setUser: (user: string) => set({ user }),
      setTask: (task: string) => set({ task }),
      setIfTracking: (ifTracking: boolean) => set({ ifTracking }),
    }),
    { name: "characify-study-manager-store" },
  ),
);
