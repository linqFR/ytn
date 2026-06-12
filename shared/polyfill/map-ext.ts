/**
 * POLYFILL: Map.prototype.getOrInsert & getOrInsertComputed (Baseline 2026)
 * This allows using the future standard Map methods today.
 */

declare global {
  interface Map<K, V> {
    /**
     * Returns the value associated with the key. 
     * If the key is not present, inserts the defaultValue and returns it.
     */
    getOrInsert(key: K, defaultValue: V): V;

    /**
     * Returns the value associated with the key.
     * If the key is not present, computes a new value using the factory, 
     * inserts it, and returns it.
     */
    getOrInsertComputed(key: K, factory: (key: K) => V): V;
  }
}

if (!Map.prototype.getOrInsert) {
  Map.prototype.getOrInsert = function <K, V>(key: K, defaultValue: V): V {
    if (this.has(key)) return this.get(key)!;
    this.set(key, defaultValue);
    return defaultValue;
  };
}

if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function <K, V>(key: K, factory: (key: K) => V): V {
    if (this.has(key)) return this.get(key)!;
    const value = factory(key);
    this.set(key, value);
    return value;
  };
}

export {};
