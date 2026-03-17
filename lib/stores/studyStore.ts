import { create } from "zustand";
import { persist } from "zustand/middleware";

type StudyState = {
  user: string;
  task: string;
  started: boolean;
  setUser: (user: string) => void;
  setTask: (task: string) => void;
  setStarted: (started: boolean) => void;
};

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      user: "annonymous",
      task: "",
      started: false,
      setUser: (user: string) => set({ user }),
      setTask: (task: string) => set({ task }),
      setStarted: (started: boolean) => set({ started }),
    }),
    { name: "characify-study-store" },
  ),
);
