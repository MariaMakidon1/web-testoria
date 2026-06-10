// LocalStorage utility for data persistence

const STORAGE_PREFIX = "testoria_";

export function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to save to localStorage: ${key}`, error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(getStorageKey(key));
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.warn(`Failed to load from localStorage: ${key}`, error);
  }
  return defaultValue;
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(getStorageKey(key));
  } catch (error) {
    console.warn(`Failed to remove from localStorage: ${key}`, error);
  }
}

export function clearAllStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear localStorage", error);
  }
}

// Generate unique IDs for local data
let idCounter = loadFromStorage<number>("id_counter", 1000);

export function generateLocalId(): number {
  idCounter++;
  saveToStorage("id_counter", idCounter);
  return idCounter;
}
