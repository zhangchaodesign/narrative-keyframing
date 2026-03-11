import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { push, ref } from "firebase/database";
import { database } from "@/app/firebaseConfig";
import { useStudyStore } from "@/lib/stores/studyStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to remove undefined values from objects
// Firebase doesn't accept undefined values, so we need to sanitize the data
function sanitizeData(data: unknown): unknown {
  if (data === undefined) {
    return null;
  }

  if (data === null || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const sanitizedValue = sanitizeData(value);
    // Only include the property if it's not undefined
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue === undefined ? null : sanitizedValue;
    }
  }

  return sanitized;
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

      // Sanitize the event data to remove undefined values
      const sanitizedData = sanitizeData(event.data);

      const newEvent = {
        action: event.action,
        data: sanitizedData,
        timestamp: Date.now(),
      };

      push(refId, newEvent);
    } catch (error) {
      console.log("event:", event);
      console.error("Error tracking event:", error);
    }
  }
}
