import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { push, ref } from "firebase/database";
import { database } from "@/app/firebaseConfig";
import { useStudyStore } from "@/lib/stores/studyStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eventTracker(event: {
  action: string;
  data: object | string | null;
}) {
  const user = useStudyStore.getState().user;
  const ifTracking = useStudyStore.getState().ifTracking;
  if (ifTracking && user !== "annonymous") {
    try {
      const task = useStudyStore.getState().task;
      const refId = ref(database, "events/" + user + "/characify" + "/" + task);
      const newEvent = {
        ...event,
        timestamp: Date.now(),
      };

      push(refId, newEvent);
    } catch (error) {
      console.log("event:", event);
      console.error("Error tracking event:", error);
    }
  }
}
