export interface ConfigStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

/**
 * localStorage-backed config persistence for Phase 1. Swap the export below
 * for a Firestore-backed implementation later without touching callers —
 * every Settings/Scheduler read or write goes through this interface.
 */
class LocalConfigStore implements ConfigStore {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export const configStore: ConfigStore = new LocalConfigStore();
