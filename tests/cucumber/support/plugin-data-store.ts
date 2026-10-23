/**
 * In-memory plugin data store for testing Obsidian plugin persistence.
 *
 * Simulates the Obsidian Plugin.loadData() / saveData() boundary so that
 * tests can verify settings persistence across plugin restarts.
 *
 * Each store holds a JSON snapshot of the plugin's data.json. A new plugin
 * instance loads from this snapshot, not from the previous instance's
 * in-memory settings object.
 */

/**
 * Create a new isolated plugin data store.
 *
 * @returns An object with loadData() and saveData() methods that mimic
 *          the Obsidian Plugin persistence API.
 */
export function createPluginDataStore() {
  // The persisted snapshot — starts empty (first-ever load)
  let persisted: Record<string, unknown> | null = null;

  return {
    /**
     * Load persisted plugin data (mimics Plugin.loadData()).
     * Returns null on first-ever load.
     */
    loadData: async (): Promise<Record<string, unknown> | null> => {
      if (!persisted) return null;
      // Return a deep copy so mutations don't affect the persisted state
      return JSON.parse(JSON.stringify(persisted));
    },

    /**
     * Save plugin data (mimics Plugin.saveData()).
     * Persists a deep copy so the caller can mutate the original.
     */
    saveData: async (data: Record<string, unknown>): Promise<void> => {
      persisted = JSON.parse(JSON.stringify(data));
    },

    /**
     * Get the raw persisted snapshot (for test assertions).
     * Returns null if nothing has been saved yet.
     */
    getPersisted: (): Record<string, unknown> | null => {
      if (!persisted) return null;
      return JSON.parse(JSON.stringify(persisted));
    },

    /**
     * Reset the store to empty state (for test isolation).
     */
    reset: (): void => {
      persisted = null;
    },
  };
}

/**
 * Type for the returned store.
 */
export type PluginDataStore = ReturnType<typeof createPluginDataStore>;
