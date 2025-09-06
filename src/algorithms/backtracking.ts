import { Item } from '../types.js';

export interface BacktrackingOptions {
  maxIters?: number;
  timeLimitMs?: number;
  enablePruning?: boolean;
  enableEarlyTermination?: boolean;
  enableBoundCalculation?: boolean;
  seed?: number;
  maxRecursionDepth?: number;
}

export interface BacktrackingResult {
  groupsByIndex: number[][];
  groupSums: number[];
  iterations: number;
  method: string;
}

/**
 * Backtracking approach for balanced partitioning with recursive branch-and-bound and pruning strategies.
 * Supports early termination and bound calculation for optimization.
 */
export function backtracking(
  items: Item[],
  groups: number,
  groupSize: number,
  options: BacktrackingOptions = {}
): BacktrackingResult {
  const {
    maxIters = 10000,
    timeLimitMs = 10000,
    enablePruning = true,
    enableEarlyTermination = true,
    enableBoundCalculation = true,
    seed,
    maxRecursionDepth = 50,
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
    throw new Error('Backtracking requires exact group size constraints');
  }

  // Sort items by capacity (descending) for better pruning
  const sortedItems = [...items].sort((a, b) => b.capacity - a.capacity);
  const capacities = sortedItems.map(item => item.capacity);

  // Calculate target sum per group
  const totalSum = kahanSum(capacities);
  const targetSum = totalSum / targetGroups;

  // Initialize best solution
  let bestDelta = Infinity;
  let bestGroups: number[][] = [];

  // Calculate lower bound for delta
  function calculateLowerBound(
    currentGroups: number[][],
    currentSums: number[]
  ): number {
    if (!enableBoundCalculation) {
      return 0;
    }

    // Calculate current delta
    let currentDelta = 0;
    for (let g = 0; g < targetGroups; g++) {
      if (currentSums[g]! > 0) {
        currentDelta = Math.max(
          currentDelta,
          Math.abs(currentSums[g]! - targetSum)
        );
      }
    }

    // Calculate remaining items capacity
    const remainingCapacity = totalSum - kahanSum(currentSums);
    const remainingItems =
      totalItems - currentGroups.reduce((sum, g) => sum + g.length, 0);

    if (remainingItems === 0) {
      return currentDelta;
    }

    // Estimate best possible delta with remaining items
    const avgRemainingPerGroup = remainingCapacity / targetGroups;
    const maxPossibleDelta = Math.max(
      currentDelta,
      Math.abs(avgRemainingPerGroup - targetSum)
    );

    return maxPossibleDelta;
  }

  // Check if current partial solution can lead to better solution
  function canImprove(
    currentGroups: number[][],
    currentSums: number[],
    currentDelta: number
  ): boolean {
    if (!enablePruning) {
      return true;
    }

    // If current delta is already worse than best, prune
    if (currentDelta >= bestDelta) {
      return false;
    }

    // Check lower bound
    const lowerBound = calculateLowerBound(currentGroups, currentSums);
    if (lowerBound >= bestDelta) {
      return false;
    }

    // Check if remaining items can fit in groups
    const remainingItems =
      totalItems - currentGroups.reduce((sum, g) => sum + g.length, 0);
    if (remainingItems === 0) {
      return true;
    }

    // Check if any group is already too full
    for (let g = 0; g < targetGroups; g++) {
      if (
        currentGroups[g]!.length === targetGroupSize &&
        currentSums[g]! > targetSum * 1.5
      ) {
        return false;
      }
    }

    return true;
  }

  // Recursive backtracking function
  function backtrackRecursive(
    itemIndex: number,
    currentGroups: number[][],
    currentSums: number[],
    currentDelta: number,
    recursionDepth: number = 0
  ): void {
    iterations++;
    if (iterations > maxIters || performance.now() - startTime > timeLimitMs) {
      return;
    }

    // Recursion depth guard to prevent stack overflow
    if (recursionDepth > maxRecursionDepth) {
      return;
    }

    // Early termination check
    if (enableEarlyTermination && bestDelta <= 0.1) {
      return;
    }

    // Check pruning conditions
    if (!canImprove(currentGroups, currentSums, currentDelta)) {
      return;
    }

    if (itemIndex === totalItems) {
      // All items assigned
      if (currentDelta < bestDelta) {
        bestDelta = currentDelta;
        bestGroups = currentGroups.map(g => [...g]);
      }
      return;
    }

    // Try assigning current item to each group
    for (let g = 0; g < targetGroups; g++) {
      if (currentGroups[g]!.length < targetGroupSize) {
        const newSum = currentSums[g]! + capacities[itemIndex]!;
        const newDelta = Math.max(currentDelta, Math.abs(newSum - targetSum));

        currentGroups[g]!.push(itemIndex);
        currentSums[g] = newSum;

        backtrackRecursive(itemIndex + 1, currentGroups, currentSums, newDelta, recursionDepth + 1);

        currentGroups[g]!.pop();
        currentSums[g] = currentSums[g]! - capacities[itemIndex]!;
      }
    }
  }

  // Initialize groups and sums
  const initialGroups: number[][] = [];
  const initialSums: number[] = [];
  for (let g = 0; g < targetGroups; g++) {
    initialGroups[g] = [];
    initialSums[g] = 0;
  }

  // Start backtracking
  backtrackRecursive(0, initialGroups, initialSums, 0, 0);

  if (bestGroups.length === 0) {
    // Fallback: simple greedy approach
    const groupsByIndex: number[][] = [];
    for (let g = 0; g < targetGroups; g++) {
      groupsByIndex[g] = [];
    }

    // Sort items by capacity (descending) and assign round-robin
    for (let i = 0; i < sortedItems.length; i++) {
      const groupIndex = i % targetGroups;
      const itemIndex = items.findIndex(item => item.id === sortedItems[i]!.id);
      if (itemIndex !== -1) {
        groupsByIndex[groupIndex]!.push(itemIndex);
      }
    }

    // Calculate group sums
    const groupSums: number[] = [];
    for (let g = 0; g < targetGroups; g++) {
      let sum = 0;
      for (let i = 0; i < groupsByIndex[g]!.length; i++) {
        sum += items[groupsByIndex[g]![i]!]!.capacity;
      }
      groupSums[g] = sum;
    }

    return {
      groupsByIndex,
      groupSums,
      iterations,
      method: 'backtracking-fallback',
    };
  }

  // Convert back to original item indices
  const groupsByIndex: number[][] = [];
  for (let g = 0; g < targetGroups; g++) {
    groupsByIndex[g] = [];
    for (let i = 0; i < bestGroups[g]!.length; i++) {
      const sortedIndex = bestGroups[g]![i]!;
      const originalIndex = items.findIndex(
        item => item.id === sortedItems[sortedIndex]!.id
      );
      if (originalIndex !== -1) {
        groupsByIndex[g]!.push(originalIndex);
      }
    }
  }

  // Calculate group sums
  const groupSums: number[] = [];
  for (let g = 0; g < targetGroups; g++) {
    let sum = 0;
    for (let i = 0; i < groupsByIndex[g]!.length; i++) {
      sum += items[groupsByIndex[g]![i]!]!.capacity;
    }
    groupSums[g] = sum;
  }

  return {
    groupsByIndex,
    groupSums,
    iterations,
    method: 'backtracking',
  };
}
