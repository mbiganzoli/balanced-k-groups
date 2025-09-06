import { Item, Grouping } from '../types.js';
import { createAlgorithmError } from '../errors.js';
import { compareItemsByCapacity } from '../utils/comparators.js';

const MAX_22_COMBINATIONS = 200000; // Skip 2-2 when C(n1,2)*C(n2,2) exceeds this

/**
 * LPT (Longest Processing Time) algorithm implementation
 * Greedy assignment by descending capacity with group-size constraint
 */
export function lptPartition(
  items: Item[],
  groups: number,
  groupSize: number,
  options: {
    useRefinement?: boolean;
    maxRefinementIters?: number;
    maxGroupsForRefinement?: number;
    maxGroupSizeForRefinement?: number;
  } = {}
): Grouping {
  const startTime = performance.now();
  const {
    useRefinement = true,
    maxRefinementIters = 100,
    maxGroupsForRefinement = 20,
    maxGroupSizeForRefinement = 50,
  } = options;

  try {
    // Initialize result structures
    const groupsById: (string | number)[][] = Array.from(
      { length: groups },
      () => []
    );
    const groupsByIndex: number[][] = Array.from({ length: groups }, () => []);
    const groupSums: number[] = new Array(groups).fill(0);
    const groupCounts: number[] = new Array(groups).fill(0);

    // Create array of items with their original indices
    const indexedItems = items.map((item, index) => ({ item, index }));

    // Sort items by capacity in descending order (LPT principle)
    indexedItems.sort((a, b) => compareItemsByCapacity(a.item, b.item));

    // Phase 1: Greedy assignment with group-size constraints
    for (const { item, index } of indexedItems) {
      // Find the group with minimum sum that still has space
      let bestGroup = -1;
      let bestSum = Infinity;

      for (let g = 0; g < groups; g++) {
        if (groupCounts[g]! < groupSize && groupSums[g]! < bestSum) {
          bestGroup = g;
          bestSum = groupSums[g]!;
        }
      }

      // If no group has space, find the group with minimum sum (this shouldn't happen with correct input)
      if (bestGroup === -1) {
        bestGroup = 0;
        for (let g = 1; g < groups; g++) {
          if (groupSums[g]! < groupSums[bestGroup]!) {
            bestGroup = g;
          }
        }
      }

      // Add item to selected group
      groupsById[bestGroup]!.push(item.id);
      groupsByIndex[bestGroup]!.push(index);
      groupSums[bestGroup]! += item.capacity;
      groupCounts[bestGroup]!++;
    }

    let iterations = 1;
    let refinementApplied = false;

    // Phase 2: Local refinement (CPU-only)
    if (useRefinement) {
      // Input size pre-check: Skip refinement for very large problems
      if (
        groups <= maxGroupsForRefinement &&
        groupSize <= maxGroupSizeForRefinement
      ) {
        iterations += performLocalRefinement(
          items,
          groupsById,
          groupsByIndex,
          groupSums,
          maxRefinementIters
        );
        refinementApplied = true;
      }
      // For large problems, use basic LPT without refinement
    }

    // Calculate quality metrics
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;

    // Calculate standard deviation
    const mean = groupSums.reduce((sum, val) => sum + val, 0) / groups;
    const variance =
      groupSums.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / groups;
    const stdev = Math.sqrt(variance);

    return {
      groupsById,
      groupsByIndex,
      groupSums,
      delta,
      stdev,
      iterations,
      methodUsed: refinementApplied ? 'lpt-refined' : 'lpt',
    };
  } catch (error) {
    const endTime = performance.now();
    throw createAlgorithmError(
      'lpt',
      'partition',
      error instanceof Error ? error.message : 'Unknown error',
      {
        executionTimeMs: endTime - startTime,
        itemCount: items.length,
        groups,
        groupSize,
      }
    );
  }
}

/**
 * Performs local refinement using swap operations (CPU-only)
 */
function performLocalRefinement(
  items: Item[],
  groupsById: (string | number)[][],
  groupsByIndex: number[][],
  groupSums: number[],
  maxIters: number
): number {
  let iterations = 0;
  let improved = true;

  while (improved && iterations < maxIters) {
    improved = false;
    iterations++;

    // Try 1-1 swaps (swap single items between groups)
    if (try11Swaps(items, groupsById, groupsByIndex, groupSums)) {
      improved = true;
      continue;
    }

    // Try 1-2 swaps (skipped; would violate fixed group sizes)

    // Try 2-2 swaps (swap two items between groups)
    if (try22Swaps(items, groupsById, groupsByIndex, groupSums)) {
      improved = true;
      continue;
    }
  }

  return iterations;
}

/**
 * Try 1-1 swaps between all pairs of groups
 */
function try11Swaps(
  items: Item[],
  groupsById: (string | number)[][],
  groupsByIndex: number[][],
  groupSums: number[]
): boolean {
  const groups = groupsById.length;

  for (let g1 = 0; g1 < groups; g1++) {
    for (let g2 = g1 + 1; g2 < groups; g2++) {
      for (let i1 = 0; i1 < groupsByIndex[g1]!.length; i1++) {
        for (let i2 = 0; i2 < groupsByIndex[g2]!.length; i2++) {
          const idx1 = groupsByIndex[g1]![i1]!;
          const idx2 = groupsByIndex[g2]![i2]!;
          const cap1 = items[idx1]!.capacity;
          const cap2 = items[idx2]!.capacity;

          // Calculate current delta
          const currentDelta = Math.max(...groupSums) - Math.min(...groupSums);

          // Calculate new sums after swap
          const newSum1 = groupSums[g1]! - cap1 + cap2;
          const newSum2 = groupSums[g2]! - cap2 + cap1;

          // Update temporary sums array
          const tempSums = [...groupSums];
          tempSums[g1] = newSum1;
          tempSums[g2] = newSum2;

          const newDelta = Math.max(...tempSums) - Math.min(...tempSums);

          // If this swap improves the balance, perform it
          if (newDelta < currentDelta) {
            // Perform the swap
            groupsById[g1]![i1] = items[idx2]!.id;
            groupsById[g2]![i2] = items[idx1]!.id;
            groupsByIndex[g1]![i1] = idx2;
            groupsByIndex[g2]![i2] = idx1;
            groupSums[g1] = newSum1;
            groupSums[g2] = newSum2;

            return true; // Found improvement
          }
        }
      }
    }
  }

  return false; // No improvement found
}

/**
 * Try 1-2 swaps (disabled for fixed group sizes)
 */

/**
 * Try 2-2 swaps between groups
 */
function try22Swaps(
  items: Item[],
  groupsById: (string | number)[][],
  groupsByIndex: number[][],
  groupSums: number[]
): boolean {
  const groups = groupsById.length;

  for (let g1 = 0; g1 < groups; g1++) {
    for (let g2 = g1 + 1; g2 < groups; g2++) {
      const n1 = groupsByIndex[g1]!.length;
      const n2 = groupsByIndex[g2]!.length;
      const comb1 = (n1 * (n1 - 1)) / 2;
      const comb2 = (n2 * (n2 - 1)) / 2;
      if (comb1 * comb2 > MAX_22_COMBINATIONS) continue; // Skip explosive cases

      // Try all pairs of items from group g1 with all pairs from group g2
      for (let i1a = 0; i1a < n1; i1a++) {
        for (let i1b = i1a + 1; i1b < n1; i1b++) {
          for (let i2a = 0; i2a < n2; i2a++) {
            for (let i2b = i2a + 1; i2b < n2; i2b++) {
              const idx1a = groupsByIndex[g1]![i1a]!;
              const idx1b = groupsByIndex[g1]![i1b]!;
              const idx2a = groupsByIndex[g2]![i2a]!;
              const idx2b = groupsByIndex[g2]![i2b]!;

              const cap1a = items[idx1a]!.capacity;
              const cap1b = items[idx1b]!.capacity;
              const cap2a = items[idx2a]!.capacity;
              const cap2b = items[idx2b]!.capacity;

              // Calculate current delta
              const currentDelta =
                Math.max(...groupSums) - Math.min(...groupSums);

              // Calculate new sums after 2-2 swap
              const newSum1 = groupSums[g1]! - cap1a - cap1b + cap2a + cap2b;
              const newSum2 = groupSums[g2]! - cap2a - cap2b + cap1a + cap1b;

              // Update temporary sums array
              const tempSums = [...groupSums];
              tempSums[g1] = newSum1;
              tempSums[g2] = newSum2;

              const newDelta = Math.max(...tempSums) - Math.min(...tempSums);

              // If this swap improves the balance, perform it
              if (newDelta < currentDelta) {
                // Perform the 2-2 swap
                groupsById[g1]![i1a] = items[idx2a]!.id;
                groupsById[g1]![i1b] = items[idx2b]!.id;
                groupsById[g2]![i2a] = items[idx1a]!.id;
                groupsById[g2]![i2b] = items[idx1b]!.id;

                groupsByIndex[g1]![i1a] = idx2a;
                groupsByIndex[g1]![i1b] = idx2b;
                groupsByIndex[g2]![i2a] = idx1a;
                groupsByIndex[g2]![i2b] = idx1b;

                groupSums[g1] = newSum1;
                groupSums[g2] = newSum2;

                return true; // Found improvement
              }
            }
          }
        }
      }
    }
  }

  return false; // No improvement found
}

/**
 * Advanced LPT with multiple phases and sophisticated refinement
 */
export function advancedLptPartition(
  items: Item[],
  groups: number,
  groupSize: number,
  options: {
    useRefinement?: boolean;
    maxRefinementIters?: number;
    useMultiPhase?: boolean;
  } = {}
): Grouping {
  const {
    useRefinement = true,
    maxRefinementIters = 100,
    useMultiPhase = true,
  } = options;

  if (!useMultiPhase) {
    return lptPartition(items, groups, groupSize, {
      useRefinement,
      maxRefinementIters,
    });
  }

  // Phase 1: Initial LPT assignment
  const result = lptPartition(items, groups, groupSize, {
    useRefinement: false,
  });

  // Phase 2: Multiple refinement rounds with different strategies
  if (useRefinement) {
    const refinementRounds = Math.min(3, Math.ceil(maxRefinementIters / 50));

    for (let round = 0; round < refinementRounds; round++) {
      const roundIters = Math.floor(maxRefinementIters / refinementRounds);
      const additionalIters = performLocalRefinement(
        items,
        result.groupsById,
        result.groupsByIndex,
        result.groupSums,
        roundIters
      );

      result.iterations = (result.iterations || 1) + additionalIters;
    }
  }

  // Recalculate final metrics
  const maxSum = Math.max(...result.groupSums);
  const minSum = Math.min(...result.groupSums);
  result.delta = maxSum - minSum;

  const mean = result.groupSums.reduce((sum, val) => sum + val, 0) / groups;
  const variance =
    result.groupSums.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    groups;
  result.stdev = Math.sqrt(variance);

  result.methodUsed = 'lpt-advanced';

  return result;
}

/**
 * Main LPT algorithm entry point (CPU-only)
 */
export function lpt(
  items: Item[],
  groups: number,
  groupSize: number,
  options: {
    useRefinement?: boolean;
    maxRefinementIters?: number;
    useAdvanced?: boolean;
  } = {}
): Grouping {
  const { useAdvanced = false } = options;

  if (useAdvanced) {
    return advancedLptPartition(items, groups, groupSize, options);
  }

  return lptPartition(items, groups, groupSize, options);
}
