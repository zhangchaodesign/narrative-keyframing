import { create } from "zustand";

type StudyState = {
  user: string;
  task: string;
  started: boolean;
  setUser: (user: string) => void;
  setTask: (task: string) => void;
  setStarted: (started: boolean) => void;
};

export const useStudyStore = create<StudyState>()((set) => ({
  user: "annonymous",
  task: "",
  started: false,
  setUser: (user: string) => set({ user }),
  setTask: (task: string) => set({ task }),
  setStarted: (started: boolean) => set({ started }),
}));
