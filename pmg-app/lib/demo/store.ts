"use client";
// Where the goals board, its agent chat and the to-do list live for now: this browser's storage, one copy per person.
// The Goals and To-dos pages share these keys, so a to-do added from either shows on both.
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export const goalsKey = (me: string) => `pmg.quarter-goals.v3.${me}`;
export const todosKey = (me: string) => `pmg.todos.v1.${me}`;
export const chatKey = (me: string) => `pmg.goal-agent.v2.${me}`;

/** State kept in localStorage under `key`, starting from `initial` until (and unless) a saved copy loads. */
export function useStored<T>(key: string, initial: () => T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem(key); if (saved) setValue(JSON.parse(saved)); } catch { /* private window or blocked storage: keep the sample */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => { if (loaded) try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not saved; the page still works */ } }, [key, value, loaded]);
  return [value, setValue, loaded];
}
