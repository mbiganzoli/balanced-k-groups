import { Item } from '../types.js';
import { createAlgorithmError } from '../errors.js';
import { globalEvaluationCache } from '../cache.js';

/**
 * Evaluation result for a grouping
 */
export interface EvaluationResult {
  /** Sum of capacities for each group */
  groupSums: number[];
  /** Delta between max and min group sums */
  delta: number;
  /** Standard deviation of group sums */
  stdev: number;
  /** Mean group sum */
  mean: number;
  /** Coefficient of variation (stdev / mean) */
  cv: number;
  /** Total capacity */
  totalCapacity: number;
}

// Internal optimized CPU path leveraging typed arrays
function evaluateGroupingFastCPU(
  items: Item[],
  groupsByIndex: number[][]
): EvaluationResult {
  const groups = groupsByIndex.length;
  const groupSums = new Float64Array(groups);

  for (let g = 0; g < groups; g++) {
    const idxs = groupsByIndex[g]!;
    let sum = 0;
    for (let i = 0; i < idxs.length; i++) {
      sum += items[idxs[i]!]!.capacity;
    }
    groupSums[g] = sum;
  }

  let total = 0;
  let maxSum = -Infinity;
  let minSum = Infinity;
  for (let g = 0; g < groups; g++) {
    const s = groupSums[g]!;
    total += s;
    if (s > maxSum) maxSum = s;
    if (s < minSum) minSum = s;
  }
  const mean = total / groups;

  let varianceAcc = 0;
  for (let g = 0; g < groups; g++) {
    const diff = groupSums[g]! - mean;
    varianceAcc += diff * diff;
  }
  const variance = varianceAcc / groups;
  const stdev = Math.sqrt(variance);

  return {
    groupSums: Array.from(groupSums),
    delta: maxSum - minSum,
    stdev,
    mean,
    cv: mean > 0 ? stdev / mean : 0,
    totalCapacity: total,
  };
}

/**
 * Evaluates the quality of a grouping (CPU-only)
 * @param items Original items array
 * @param groupsByIndex Groups organized by item indices
 * @returns Evaluation metrics
 */
/**
 * Simple hash function for grouping keys to avoid expensive JSON.stringify
 */
function hashGrouping(groupsByIndex: number[][]): string {
  let hash = 0;
  for (let g = 0; g < groupsByIndex.length; g++) {
    const group = groupsByIndex[g]!;
    for (let i = 0; i < group.length; i++) {
      hash = ((hash << 5) - hash + group[i]!) & 0xffffffff;
    }
  }
  return hash.toString(36);
}

export function evaluateGrouping(
  items: Item[],
  groupsByIndex: number[][],
  options: {
    maxCacheItems?: number;
    maxCacheGroups?: number;
    maxCacheGroupSize?: number;
  } = {}
): EvaluationResult {
  const {
    maxCacheItems = 1000,
    maxCacheGroups = 50,
    maxCacheGroupSize = 100,
  } = options;

  try {
    // Enhanced size guards: Skip caching for very large groupings to prevent DoS
    const totalItems = groupsByIndex.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const groupCount = groupsByIndex.length;
    const maxGroupSize = Math.max(...groupsByIndex.map(g => g.length));

    // Multiple size checks for comprehensive protection
    const shouldSkipCache = 
      totalItems > maxCacheItems ||
      groupCount > maxCacheGroups ||
      maxGroupSize > maxCacheGroupSize;

    let groupingKey: string;
    if (shouldSkipCache) {
      // Skip caching for large groupings
      groupingKey = '';
    } else {
      // Use bounded hash instead of JSON.stringify
      groupingKey = hashGrouping(groupsByIndex);
    }

    // Try cache first (only for small groupings)
    if (groupingKey) {
      const cached = globalEvaluationCache.get(
        items as unknown as object,
        groupingKey
      );
      if (cached) return cached as EvaluationResult;
    }

    // CPU implementation
    const result = evaluateGroupingFastCPU(items, groupsByIndex);

    // Only cache small groupings
    if (groupingKey) {
      globalEvaluationCache.set(
        items as unknown as object,
        groupingKey,
        result
      );
    }

    return result;
  } catch (error) {
    throw createAlgorithmError(
      'evaluate',
      'grouping evaluation',
      error instanceof Error ? error.message : 'Unknown error',
      {
        groupCount: groupsByIndex.length,
        itemCount: items.length,
      }
    );
  }
}

/**
 * Calculates the balance score of a grouping (lower is better)
 * Combines delta and standard deviation with configurable weights
 */
export function calculateBalanceScore(
  evaluation: EvaluationResult,
  options: {
    deltaWeight?: number;
    stdevWeight?: number;
    cvWeight?: number;
  } = {}
): number {
  const { deltaWeight = 1.0, stdevWeight = 1.0, cvWeight = 0.5 } = options;

  return (
    deltaWeight * evaluation.delta +
    stdevWeight * evaluation.stdev +
    cvWeight * evaluation.cv
  );
}

/**
 * Compares two groupings and returns which one is better
 * @param eval1 First evaluation
 * @param eval2 Second evaluation
 * @returns -1 if eval1 is better, 1 if eval2 is better, 0 if equal
 */
export function compareGroupings(
  eval1: EvaluationResult,
  eval2: EvaluationResult,
  options: {
    deltaWeight?: number;
    stdevWeight?: number;
    cvWeight?: number;
  } = {}
): number {
  const score1 = calculateBalanceScore(eval1, options);
  const score2 = calculateBalanceScore(eval2, options);

  if (score1 < score2) return -1;
  if (score1 > score2) return 1;
  return 0;
}

/**
 * Checks if a grouping satisfies balance constraints
 */
export function satisfiesBalanceConstraints(
  evaluation: EvaluationResult,
  constraints: {
    maxDelta?: number;
    maxStdev?: number;
    maxCV?: number;
  }
): boolean {
  const { maxDelta, maxStdev, maxCV } = constraints;

  if (maxDelta !== undefined && evaluation.delta > maxDelta) {
    return false;
  }

  if (maxStdev !== undefined && evaluation.stdev > maxStdev) {
    return false;
  }

  if (maxCV !== undefined && evaluation.cv > maxCV) {
    return false;
  }

  return true;
}

/**
 * Creates a readable summary of the evaluation
 */
export function summarizeEvaluation(evaluation: EvaluationResult): string {
  const { groupSums, delta, stdev, mean, cv, totalCapacity } = evaluation;

  return [
    `Groups: ${groupSums.length}`,
    `Total Capacity: ${totalCapacity.toFixed(2)}`,
    `Mean: ${mean.toFixed(2)}`,
    `Delta: ${delta.toFixed(2)}`,
    `Std Dev: ${stdev.toFixed(2)}`,
    `CV: ${(cv * 100).toFixed(1)}%`,
    `Sums: [${groupSums.map(s => s.toFixed(2)).join(', ')}]`,
  ].join(' | ');
}

/**
 * Validates that a grouping is feasible
 */
export function validateGrouping(
  items: Item[],
  groupsByIndex: number[][],
  expectedGroupSize: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check group sizes
  for (let i = 0; i < groupsByIndex.length; i++) {
    const group = groupsByIndex[i]!;
    if (group.length !== expectedGroupSize) {
      errors.push(
        `Group ${i} has ${group.length} items, expected ${expectedGroupSize}`
      );
    }
  }

  // Check all items are assigned exactly once
  const allIndices = groupsByIndex.flat();
  const uniqueIndices = new Set(allIndices);

  if (allIndices.length !== uniqueIndices.size) {
    errors.push('Some items are assigned to multiple groups');
  }

  if (uniqueIndices.size !== items.length) {
    errors.push(
      `${uniqueIndices.size} items assigned, expected ${items.length}`
    );
  }

  // Check indices are valid
  for (const index of allIndices) {
    if (index < 0 || index >= items.length) {
      errors.push(`Invalid item index: ${index}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to use Kahan summation for better numerical precision
 */
export function kahanSum(values: number[]): number {
  let sum = 0;
  let compensation = 0;

  for (const value of values) {
    const correctedValue = value - compensation;
    const tempSum = sum + correctedValue;
    compensation = tempSum - sum - correctedValue;
    sum = tempSum;
  }

  return sum;
}

/**
 * Evaluates grouping with enhanced numerical precision (CPU-only)
 */
export function evaluateGroupingPrecise(
  items: Item[],
  groupsByIndex: number[][]
): EvaluationResult {
  try {
    // Calculate group sums using Kahan summation for better precision
    const groupSums = groupsByIndex.map(group => {
      const capacities = group.map(index => items[index]!.capacity);
      return kahanSum(capacities);
    });

    // Calculate quality metrics
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;
    const totalCapacity = kahanSum(groupSums);
    const mean = totalCapacity / groupSums.length;

    // Calculate standard deviation with Kahan summation
    const squaredDeviations = groupSums.map(groupSum =>
      Math.pow(groupSum - mean, 2)
    );
    const variance = kahanSum(squaredDeviations) / groupSums.length;
    const stdev = Math.sqrt(variance);

    // Calculate coefficient of variation
    const cv = mean > 0 ? stdev / mean : 0;

    return {
      groupSums,
      delta,
      stdev,
      mean,
      cv,
      totalCapacity,
    };
  } catch (error) {
    throw createAlgorithmError(
      'evaluate-precise',
      'precise grouping evaluation',
      error instanceof Error ? error.message : 'Unknown error',
      {
        groupCount: groupsByIndex.length,
        itemCount: items.length,
      }
    );
  }
}
