import { useState, useCallback } from "react";

const STORAGE_KEY = "sonoma-my-list";

export interface SavedSpot {
  id: number;
  name: string;
  category: string;
  city: string | null;
}

export function useMyList() {
  const [saved, setSaved] = useState<Map<number, SavedSpot>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return new Map();
      const arr: SavedSpot[] = JSON.parse(stored);
      return new Map(arr.map((s) => [s.id, s]));
    } catch {
      return new Map();
    }
  });

  const persist = (next: Map<number, SavedSpot>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next.values()]));
  };

  const toggle = useCallback((spot: SavedSpot) => {
    setSaved((prev) => {
      const next = new Map(prev);
      if (next.has(spot.id)) {
        next.delete(spot.id);
      } else {
        next.set(spot.id, spot);
      }
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setSaved((prev) => {
      const next = new Map(prev);
      next.delete(id);
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSaved(new Map());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isSaved = useCallback(
    (id: number) => saved.has(id),
    [saved]
  );

  return { saved, toggle, remove, isSaved, clearAll };
}
