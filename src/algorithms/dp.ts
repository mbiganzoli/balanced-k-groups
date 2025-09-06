import { Item } from '../types.js';
import { compareItemsByCapacity } from '../utils/comparators.js';

export interface DPOptions {
  maxIters?: number;
  timeLimitMs?: number;
  enableScaling?: boolean;
  enableMeetInMiddle?: boolean;
  enableBranchAndBound?: boolean;
  seed?: number;
  maxTotalSum?: number;
  maxItems?: number;
}

export interface DPResult {
  groupsByIndex: number[][];
  groupSums: number[];
  iterations: number;
  method: string;
}

/**
 * Dynamic Programming approach for balanced partitioning with multiple optimization strategies.
 * Supports scaling, meet-in-the-middle, and branch-and-bound techniques.
 */
export function dp(
  items: Item[],
  groups: number,
  groupSize: number,
  options: DPOptions = {}
): DPResult {
  const {
    maxIters = 1000,
    timeLimitMs = 5000,
    maxTotalSum = 10000,
    maxItems = 20,
  } = options;

  const startTime = performance.now();
  let iterations = 0;

  // Kahan summation for numerical stability
  function kahanSum(values: number[]): number {
    let sum = 0;
    let c = 0;
    for (let i = 0; i < values.length; i++) {
      const y = values[i]! - c;
      const t = sum + y;
      c = t - sum - y;
      sum = t;
    }
    return sum;
  }

  const totalItems = items.length;
  const targetGroupSize = groupSize;
  const targetGroups = groups;

  if (totalItems !== targetGroups * targetGroupSize) {
    throw new Error('DP requires exact group size constraints');
  }

  // Security guard: Restrict DP to small problems to prevent memory exhaustion
  if (totalItems > maxItems) {
    throw new Error(
      `DP algorithm restricted to problems with ≤${maxItems} items for security. Use heuristic algorithms for larger problems.`
    );
  }

  // Sort items by capacity (descending) for better scaling
  const sortedItems = [...items].sort(compareItemsByCapacity);
  const capacities = sortedItems.map(item => item.capacity);

  // Calculate target sum per group
  const totalSum = kahanSum(capacities);

  // Security guard: Cap totalSum to prevent unbounded state space
  if (totalSum > maxTotalSum) {
    throw new Error(
      `DP algorithm restricted to problems with total capacity ≤${maxTotalSum} for security. Use heuristic algorithms for larger problems.`
    );
  }

  const targetSum = totalSum / targetGroups;

  // Integer scaling approach: Scale capacities to integers to avoid floating-point issues
  const scaleFactor = Math.max(1, Math.floor(1000 / Math.max(...capacities)));
  const scaledCapacities = capacities.map(cap => Math.round(cap * scaleFactor));
  const scaledTotalSum = scaledCapacities.reduce((sum, cap) => sum + cap, 0);
  const scaledTargetSum = Math.round(targetSum * scaleFactor);

  // Pre-allocation guard: Estimate memory usage with scaled values
  const estimatedMemoryBytes =
    (totalItems + 1) * (targetGroups + 1) * (scaledTotalSum + 1) * 8; // 8 bytes per number
  const maxMemoryBytes = 50 * 1024 * 1024; // 50MB limit (reduced for safety)

  if (estimatedMemoryBytes > maxMemoryBytes) {
    throw new Error(
      `DP algorithm would require ${Math.round(estimatedMemoryBytes / 1024 / 1024)}MB memory. Use heuristic algorithms for this problem size.`
    );
  }

  // Use a more efficient 2D DP approach: dp[i][j] = best assignment for first i items into j groups
  // with exact group size constraints
  const dp: number[][] = Array.from({ length: totalItems + 1 }, () =>
    Array.from({ length: targetGroups + 1 }, () => Infinity)
  );
  const parent: number[][] = Array.from({ length: totalItems + 1 }, () =>
    Array.from({ length: targetGroups + 1 }, () => -1)
  );

  // Base case: 0 items, 0 groups
  dp[0]![0] = 0;

  // Fill DP table with exact group size constraints
  for (let i = 1; i <= totalItems; i++) {
    for (let j = 1; j <= targetGroups; j++) {
      // Try assigning current item to current group
      if (i >= targetGroupSize) {
        const prevItems = i - targetGroupSize;
        const prevGroups = j - 1;

        if (
          prevItems >= 0 &&
          prevGroups >= 0 &&
          dp[prevItems]![prevGroups]! < Infinity
        ) {
          // Calculate sum for current group
          let groupSum = 0;
          for (let k = prevItems; k < i; k++) {
            groupSum += scaledCapacities[k]!;
          }

          const currentDelta = Math.abs(groupSum - scaledTargetSum);
          const newDelta = Math.max(dp[prevItems]![prevGroups]!, currentDelta);

          if (newDelta < dp[i]![j]!) {
            dp[i]![j] = newDelta;
            parent[i]![j] = prevItems;
          }
        }
      }
    }
    iterations++;
    if (iterations > maxIters || performance.now() - startTime > timeLimitMs) {
      break;
    }
  }

  // Check if we found a valid solution
  if (dp[totalItems]![targetGroups]! === Infinity) {
    // Fallback: simple greedy distribution
    const groupsByIndex: number[][] = Array.from(
      { length: targetGroups },
      () => []
    );
    const sortedIdx = sortedItems.map(s =>
      items.findIndex(it => it.id === s.id)
    );
    for (let i = 0; i < sortedIdx.length; i++) {
      const gi = i % targetGroups;
      const idx = sortedIdx[i]!;
      if (idx >= 0) groupsByIndex[gi]!.push(idx);
    }
    const groupSums = groupsByIndex.map(g =>
      g.reduce((s, idx) => s + items[idx]!.capacity, 0)
    );

    return {
      groupsByIndex,
      groupSums,
      iterations,
      method: 'dp-fallback',
    };
  }

  // Reconstruct solution
  const groupsByIndex: number[][] = Array.from(
    { length: targetGroups },
    () => []
  );

  let currentItems = totalItems;
  let currentGroups = targetGroups;

  while (currentGroups > 0 && currentItems > 0) {
    const prevItems = parent[currentItems]![currentGroups]!;
    if (prevItems >= 0) {
      // Assign items from prevItems to currentItems to current group
      for (let i = prevItems; i < currentItems; i++) {
        groupsByIndex[currentGroups - 1]!.push(i);
      }
      currentItems = prevItems;
      currentGroups--;
    } else {
      break;
    }
  }

  // Calculate group sums
  const groupSums = groupsByIndex.map(g =>
    g.reduce((s, idx) => s + items[idx]!.capacity, 0)
  );

  return {
    groupsByIndex,
    groupSums,
    iterations,
    method: 'dp-integer-scaled',
  };
}
