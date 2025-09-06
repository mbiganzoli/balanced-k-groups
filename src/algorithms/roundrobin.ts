import { Item, Grouping } from '../types.js';
import { createAlgorithmError } from '../errors.js';
import { compareItemsByCapacity } from '../utils/comparators.js';

/**
 * Round-robin greedy algorithm implementation
 * Sorts items by capacity (descending) and distributes them cyclically across groups
 */
export function roundRobinPartition(
  items: Item[],
  groups: number,
  groupSize: number,
  _seed?: number
): Grouping {
  const startTime = performance.now();

  try {
    // Initialize result structures
    const groupsById: (string | number)[][] = Array.from(
      { length: groups },
      () => []
    );
    const groupsByIndex: number[][] = Array.from({ length: groups }, () => []);
    const groupSums: number[] = new Array(groups).fill(0);

    // Create array of items with their original indices
    const indexedItems = items.map((item, index) => ({ item, index }));

    // Sort items by capacity in descending order for better balance
    indexedItems.sort((a, b) => compareItemsByCapacity(a.item, b.item));

    // Distribute items round-robin across groups
    let currentGroup = 0;
    for (const { item, index } of indexedItems) {
      // Add item to current group
      groupsById[currentGroup]!.push(item.id);
      groupsByIndex[currentGroup]!.push(index);
      groupSums[currentGroup]! += item.capacity;

      // Move to next group (round-robin)
      currentGroup = (currentGroup + 1) % groups;
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

    // const endTime = performance.now();

    return {
      groupsById,
      groupsByIndex,
      groupSums,
      delta,
      stdev,
      iterations: 1, // Round-robin is a single-pass algorithm
      methodUsed: 'roundrobin',
    };
  } catch (error) {
    const endTime = performance.now();
    throw createAlgorithmError(
      'roundrobin',
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
 * Optimized round-robin with capacity-aware distribution
 * Attempts to balance groups better by considering current group sums
 */
export function optimizedRoundRobinPartition(
  items: Item[],
  groups: number,
  groupSize: number,
  _seed?: number
): Grouping {
  const startTime = performance.now();

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

    // Sort items by capacity in descending order
    indexedItems.sort((a, b) => compareItemsByCapacity(a.item, b.item));

    // Distribute items with capacity-aware assignment
    for (const { item, index } of indexedItems) {
      // Find the group with the smallest current sum that still has space
      let bestGroup = 0;
      let bestSum = groupSums[0]!;

      for (let g = 1; g < groups; g++) {
        if (groupCounts[g]! < groupSize && groupSums[g]! < bestSum) {
          bestGroup = g;
          bestSum = groupSums[g]!;
        }
      }

      // If all groups are full at this level, use round-robin
      if (groupCounts[bestGroup]! >= groupSize) {
        // Find first group with space
        for (let g = 0; g < groups; g++) {
          if (groupCounts[g]! < groupSize) {
            bestGroup = g;
            break;
          }
        }
      }

      // Add item to selected group
      groupsById[bestGroup]!.push(item.id);
      groupsByIndex[bestGroup]!.push(index);
      groupSums[bestGroup]! += item.capacity;
      groupCounts[bestGroup]!++;
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

    // const endTime = performance.now();

    return {
      groupsById,
      groupsByIndex,
      groupSums,
      delta,
      stdev,
      iterations: 1,
      methodUsed: 'roundrobin-optimized',
    };
  } catch (error) {
    const endTime = performance.now();
    throw createAlgorithmError(
      'roundrobin-optimized',
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
 * Main round-robin algorithm entry point
 * Chooses between basic and optimized versions based on problem size
 */
export function roundRobin(
  items: Item[],
  groups: number,
  groupSize: number,
  options: { seed?: number; optimized?: boolean } = {}
): Grouping {
  const { seed, optimized = true } = options;

  // For small problems or when explicitly requested, use basic round-robin
  if (!optimized || items.length <= 20) {
    return roundRobinPartition(items, groups, groupSize, seed);
  }

  // For larger problems, use optimized version
  return optimizedRoundRobinPartition(items, groups, groupSize, seed);
}
