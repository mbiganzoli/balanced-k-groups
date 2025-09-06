export interface EvaluationCacheKey {
  /** Reference to the items array used for evaluation */
  itemsRef: object;
  /** Serialized grouping key */
  groupingKey: string;
}

export interface EvaluationCacheValue<T> {
  value: T;
  timestamp: number;
}

/**
 * Simple evaluation cache keyed by items reference and grouping structure.
 * Helps avoid repeated evaluation of identical groupings.
 */
export class EvaluationCache<T> {
  private store: WeakMap<object, Map<string, EvaluationCacheValue<T>>> = new WeakMap();
  private maxEntriesPerItemsRef: number;

  constructor(maxEntriesPerItemsRef: number = 100) {
    this.maxEntriesPerItemsRef = Math.max(10, maxEntriesPerItemsRef);
  }

  private getBucket(itemsRef: object): Map<string, EvaluationCacheValue<T>> {
    let bucket = this.store.get(itemsRef);
    if (!bucket) {
      bucket = new Map();
      this.store.set(itemsRef, bucket);
    }
    return bucket;
  }

  get(itemsRef: object, groupingKey: string): T | undefined {
    const bucket = this.store.get(itemsRef);
    const entry = bucket?.get(groupingKey);
    return entry?.value;
  }

  set(itemsRef: object, groupingKey: string, value: T): void {
    const bucket = this.getBucket(itemsRef);
    if (bucket.size >= this.maxEntriesPerItemsRef) {
      // Delete oldest entry (simple FIFO by insertion order)
      const firstKey = bucket.keys().next().value as string | undefined;
      if (firstKey) bucket.delete(firstKey);
    }
    bucket.set(groupingKey, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.store = new WeakMap();
  }
}

export const globalEvaluationCache = new EvaluationCache<any>(200);
