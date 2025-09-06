/**
 * Utility functions for consistent comparison across the library
 */

/**
 * Utility function to compare IDs deterministically across mixed types
 * Ensures consistent ordering regardless of whether IDs are strings or numbers
 */
export function compareIds(a: string | number, b: string | number): number {
  const strA = String(a);
  const strB = String(b);
  if (strA < strB) return -1;
  if (strA > strB) return 1;
  return 0;
}

/**
 * Compare items by capacity with deterministic ID tie-breaker
 */
export function compareItemsByCapacity(
  a: { capacity: number; id: string | number },
  b: { capacity: number; id: string | number }
): number {
  const capacityDiff = b.capacity - a.capacity; // Descending order
  if (capacityDiff !== 0) return capacityDiff;
  
  // For equal capacities, use deterministic ordering based on ID
  return compareIds(a.id, b.id);
}
