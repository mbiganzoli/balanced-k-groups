import { Item, PartitionOptions, Grouping, NormalizedOptions } from './types.js';
import {
  validatePartitionInputs,
  validatePartitionOptions,
  ensureInputImmutability,
} from './validation.js';
import { evaluateGrouping, validateGrouping } from './algorithms/evaluate.js';
import { roundRobin } from './algorithms/roundrobin.js';
import { lpt } from './algorithms/lpt.js';
import { kk } from './algorithms/kk.js';
import {
  defaultRecoveryManager,
  createGracefulDegradation,
} from './recovery.js';
import { createAlgorithmError, isBalancedKGroupsError } from './errors.js';
import { dp } from './algorithms/dp.js';
import { backtracking } from './algorithms/backtracking.js';
import { flow } from './algorithms/flow.js';
import { metaheuristic } from './algorithms/metaheuristic.js';
import { globalPerformanceHistoryTracker } from './performanceHistory.js';

/**
 * Normalizes and validates partition options with defaults
 */
function normalizeOptions(options: PartitionOptions = {}): NormalizedOptions {
  return {
    method: options.method ?? 'auto',
    timeLimitMs: options.timeLimitMs ?? 30000,
    seed: options.seed,
    maxIters: options.maxIters ?? 1000,
    tolerance: options.tolerance ?? 1e-6,
    earlyStopDelta: options.earlyStopDelta ?? 0,
    preferredAlgorithms: options.preferredAlgorithms,
    disallowedAlgorithms: options.disallowedAlgorithms,
    selectionStrategy: options.selectionStrategy,
    hybrid: options.hybrid,
    allowPlaceholderAlgorithms: options.allowPlaceholderAlgorithms ?? false,
  };
}

/**
 * Main function to partition items into balanced groups
 * @param items Array of items to partition
 * @param groups Number of groups to create
 * @param groupSize Number of items per group
 * @param options Configuration options
 * @returns Partitioning result with groups and metrics
 * @example
 * const items = fromCapacities([10, 8, 6, 4, 2, 1]);
 * const result = partitionBalanced(items, 2, 3, { method: 'auto', timeLimitMs: 500 });
 * console.log(result.groupsById, result.delta);
 */
export function partitionBalanced(
  items: Item[],
  groups: number,
  groupSize: number,
  options: PartitionOptions = {}
): Grouping {
  const startTime = performance.now();

  try {
    // Validate inputs
    validatePartitionInputs(items, groups, groupSize);
    validatePartitionOptions(options as Record<string, unknown>);

    // Ensure input immutability
    const itemsCopy = ensureInputImmutability(items);

    // Normalize options with defaults
    const normalizedOptions = normalizeOptions(options);

    // Global pre-checks for recursion/iteration-heavy algorithms
    const totalItems = itemsCopy.length;
    const isLargeProblem = totalItems > 50 || groups > 10 || groupSize > 20;
    const isVeryLargeProblem = totalItems > 100 || groups > 20 || groupSize > 50;

    // Early fallback to simpler heuristics for very large problems
    if (isVeryLargeProblem && normalizedOptions.method === 'auto') {
      // Force simpler algorithms for very large problems
      normalizedOptions.preferredAlgorithms = ['roundrobin', 'lpt'];
      normalizedOptions.disallowedAlgorithms = ['dp', 'backtracking', 'metaheuristic'];
    }

    // Choose and execute algorithm
    let result: Grouping;

    try {
      switch (normalizedOptions.method) {
        case 'roundrobin':
          result = roundRobin(itemsCopy, groups, groupSize, { 
            seed: normalizedOptions.seed 
          });
          break;

        case 'lpt':
          result = lpt(itemsCopy, groups, groupSize, {
            useRefinement: !isLargeProblem, // Skip refinement for large problems
            maxRefinementIters: Math.floor(normalizedOptions.maxIters / 10),
          });
          break;

        case 'kk':
          result = kk(itemsCopy, groups, groupSize);
          break;

        case 'auto':
        default:
          result = executeAutoStrategy(itemsCopy, groups, groupSize, {
            timeLimitMs: normalizedOptions.timeLimitMs,
            seed: normalizedOptions.seed,
            maxIters: normalizedOptions.maxIters,
            tolerance: normalizedOptions.tolerance,
            earlyStopDelta: normalizedOptions.earlyStopDelta,
            preferredAlgorithms: normalizedOptions.preferredAlgorithms,
            disallowedAlgorithms: normalizedOptions.disallowedAlgorithms,
            selectionStrategy: normalizedOptions.selectionStrategy,
            hybrid: normalizedOptions.hybrid,
            isLargeProblem,
            isVeryLargeProblem,
          });
          break;
      }

      // Validate result
      const validation = validateGrouping(
        itemsCopy,
        result.groupsByIndex,
        groupSize
      );
      if (!validation.valid) {
        throw createAlgorithmError(
          result.methodUsed,
          'result validation',
          `Invalid result: ${validation.errors.join(', ')}`
        );
      }

      // Compute evaluation metrics on CPU
      const evalResult = evaluateGrouping(itemsCopy, result.groupsByIndex, {
        maxCacheItems: isLargeProblem ? 500 : 1000,
        maxCacheGroups: isLargeProblem ? 25 : 50,
        maxCacheGroupSize: isLargeProblem ? 50 : 100,
      });
      result.groupSums = evalResult.groupSums;
      result.delta = evalResult.delta;
      result.stdev = evalResult.stdev;

      return result;
    } catch (algorithmError) {
      // Attempt recovery
      const error =
        algorithmError instanceof Error
          ? algorithmError
          : new Error(String(algorithmError));
      const recoveredResult = defaultRecoveryManager.recover(
        itemsCopy,
        groups,
        groupSize,
        normalizedOptions,
        error
      );

      if (recoveredResult) {
        return recoveredResult;
      }

      // If recovery fails, create graceful degradation
      return createGracefulDegradation(itemsCopy, groups, groupSize, error);
    }
  } catch (error) {
    const endTime = performance.now();

    if (isBalancedKGroupsError(error)) {
      throw error; // Re-throw library errors as-is
    }

    throw createAlgorithmError(
      'partitionBalanced',
      'main function',
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
 * Execute auto strategy with multiple algorithms
 */
function executeAutoStrategy(
  items: Item[],
  groups: number,
  groupSize: number,
  options: {
    timeLimitMs: number;
    seed?: number;
    maxIters: number;
    tolerance: number;
    earlyStopDelta: number;
    preferredAlgorithms?: string[];
    disallowedAlgorithms?: string[];
    selectionStrategy?: 'speed' | 'quality' | 'balanced';
    hybrid?: { enable?: boolean; refineIters?: number };
    isLargeProblem?: boolean;
    isVeryLargeProblem?: boolean;
    allowPlaceholderAlgorithms?: boolean;
  }
): Grouping {
  const startTime = performance.now();
  let bestResult: Grouping | null = null;

  let baseCandidates = determineCandidateAlgorithms(
    items.length,
    groups,
    groupSize,
    options.timeLimitMs,
    options.allowPlaceholderAlgorithms ?? false
  );

  // Apply disallowed filter
  if (options.disallowedAlgorithms && options.disallowedAlgorithms.length) {
    const disallowed = new Set(
      options.disallowedAlgorithms.map(a => a.toLowerCase())
    );
    baseCandidates = baseCandidates.filter(a => !disallowed.has(a));
  }

  // Apply preferred ordering boost
  if (options.preferredAlgorithms && options.preferredAlgorithms.length) {
    const preferred = new Set(
      options.preferredAlgorithms.map(a => a.toLowerCase())
    );
    baseCandidates = baseCandidates.sort((a, b) => {
      const pa = preferred.has(a) ? 1 : 0;
      const pb = preferred.has(b) ? 1 : 0;
      return pb - pa;
    });
  }

  let candidates = prioritizeByHistory(
    baseCandidates,
    items.length,
    groups,
    groupSize,
    options.timeLimitMs
  );

  // Selection strategy influence (simple reordering):
  if (options.selectionStrategy === 'quality') {
    // Prefer algorithms likely to improve delta: kk, lpt, dp
    const priority = new Map([
      ['kk', 3],
      ['lpt', 2],
      ['dp', 2],
      ['backtracking', 1],
      ['flow', 1],
      ['metaheuristic', 1],
      ['roundrobin', 0],
    ]);
    candidates = candidates
      .slice()
      .sort((a, b) => (priority.get(b) ?? 0) - (priority.get(a) ?? 0));
  } else if (options.selectionStrategy === 'speed') {
    // Prefer faster: roundrobin, lpt, kk
    const priority = new Map([
      ['roundrobin', 3],
      ['lpt', 2],
      ['kk', 2],
      ['flow', 1],
      ['dp', 0],
      ['backtracking', 0],
      ['metaheuristic', 0],
    ]);
    candidates = candidates
      .slice()
      .sort((a, b) => (priority.get(b) ?? 0) - (priority.get(a) ?? 0));
  }

  const perAlgoBudget = Math.max(
    5,
    Math.floor(options.timeLimitMs / Math.max(1, candidates.length))
  );

  const tryUpdateBest = (candidate: Grouping) => {
    if (!bestResult || candidate.delta < bestResult.delta) {
      bestResult = candidate;
    }
  };

  for (const algo of candidates) {
    const elapsed = performance.now() - startTime;
    if (elapsed > options.timeLimitMs) {
      break;
    }

    try {
      switch (algo) {
        case 'roundrobin': {
          const rr = roundRobin(items, groups, groupSize, {
            seed: options.seed,
          });
          tryUpdateBest(rr);
          if (rr.delta <= options.earlyStopDelta) return rr;
          break;
        }
        case 'lpt': {
          const lptRes = lpt(items, groups, groupSize, {
            useRefinement: true,
            maxRefinementIters: Math.max(10, Math.floor(options.maxIters / 5)),
          });
          tryUpdateBest(lptRes);
          if (lptRes.delta <= options.earlyStopDelta) return lptRes;
          break;
        }
        case 'kk': {
          const kkRes = kk(items, groups, groupSize);
          tryUpdateBest(kkRes);
          if (kkRes.delta <= options.earlyStopDelta) return kkRes;
          break;
        }
        case 'dp': {
          const dpRes = dp(items, groups, groupSize, {
            timeLimitMs: perAlgoBudget,
            enableScaling: true,
            enableMeetInMiddle: items.length >= 8,
            enableBranchAndBound: items.length <= 10,
            seed: options.seed,
          });
          tryUpdateBest({
            groupsById: dpRes.groupsByIndex.map(g => g.map(i => items[i]!.id)),
            groupsByIndex: dpRes.groupsByIndex,
            groupSums: dpRes.groupSums,
            delta: Math.max(...dpRes.groupSums) - Math.min(...dpRes.groupSums),
            stdev: 0,
            iterations: dpRes.iterations,
            methodUsed: dpRes.method,
          });
          break;
        }
        case 'backtracking': {
          const btRes = backtracking(items, groups, groupSize, {
            timeLimitMs: perAlgoBudget,
            enablePruning: true,
            enableEarlyTermination: true,
            enableBoundCalculation: true,
            seed: options.seed,
            maxRecursionDepth: options.isLargeProblem ? 20 : 50, // Reduce recursion depth for large problems
          });
          tryUpdateBest({
            groupsById: btRes.groupsByIndex.map(g => g.map(i => items[i]!.id)),
            groupsByIndex: btRes.groupsByIndex,
            groupSums: btRes.groupSums,
            delta: Math.max(...btRes.groupSums) - Math.min(...btRes.groupSums),
            stdev: 0,
            iterations: btRes.iterations,
            methodUsed: btRes.method,
          });
          break;
        }
        case 'flow': {
          const flRes = flow(items, groups, groupSize, {
            timeLimitMs: perAlgoBudget,
          });
          tryUpdateBest({
            groupsById: flRes.groupsByIndex.map(g => g.map(i => items[i]!.id)),
            groupsByIndex: flRes.groupsByIndex,
            groupSums: flRes.groupSums,
            delta: Math.max(...flRes.groupSums) - Math.min(...flRes.groupSums),
            stdev: 0,
            iterations: flRes.iterations,
            methodUsed: flRes.method,
          });
          break;
        }
        case 'metaheuristic': {
          const mhRes = metaheuristic(items, groups, groupSize, {
            type: 'genetic',
            timeLimitMs: perAlgoBudget,
            maxIters: Math.max(100, Math.floor(options.maxIters / 2)),
            seed: options.seed,
          });
          tryUpdateBest({
            groupsById: mhRes.groupsByIndex.map(g => g.map(i => items[i]!.id)),
            groupsByIndex: mhRes.groupsByIndex,
            groupSums: mhRes.groupSums,
            delta: Math.max(...mhRes.groupSums) - Math.min(...mhRes.groupSums),
            stdev: 0,
            iterations: mhRes.iterations,
            methodUsed: mhRes.method,
          });
          break;
        }
        default:
          break;
      }
    } catch {
      // Ignore failures and continue to next candidate
    }
  }

  // Optional hybrid refinement step on the bestResult
  if (options.hybrid?.enable && bestResult) {
    const refineIters = Math.max(
      5,
      options.hybrid.refineIters ?? Math.floor(options.maxIters / 10)
    );
    try {
      const refined = lpt(items, groups, groupSize, {
        useRefinement: true,
        maxRefinementIters: refineIters,
      });
      const currentBest = bestResult as Grouping;
      if (refined.delta < currentBest.delta) {
        bestResult = refined;
      }
    } catch {
      // ignore refinement failure
    }
  }

  return (
    bestResult ||
    createGracefulDegradation(
      items,
      groups,
      groupSize,
      new Error('All strategies failed')
    )
  );
}

function determineCandidateAlgorithms(
  problemSize: number,
  _groups: number,
  _groupSize: number,
  timeLimitMs: number,
  allowPlaceholderAlgorithms: boolean = false
): string[] {
  const candidates: string[] = [];

  // Always include roundrobin as baseline
  candidates.push('roundrobin');

  // Small problems: enable exact/structured approaches
  if (problemSize <= 12) {
    candidates.push('dp', 'backtracking', 'lpt', 'kk');
    if (allowPlaceholderAlgorithms) {
      candidates.push('flow', 'ilp');
    }
    return candidates;
  }

  // Medium problems
  if (problemSize <= 60) {
    candidates.push('lpt', 'kk');
    if (allowPlaceholderAlgorithms) {
      candidates.push('flow', 'ilp');
    }
    return candidates;
  }

  // Large problems
  candidates.push('lpt', 'kk');
  if (timeLimitMs >= 300) {
    candidates.push('metaheuristic');
  }
  if (allowPlaceholderAlgorithms) {
    candidates.push('flow', 'ilp');
  }
  return candidates;
}

function prioritizeByHistory(
  candidates: string[],
  problemSize: number,
  groups: number,
  groupSize: number,
  timeLimitMs: number
): string[] {
  const recs = globalPerformanceHistoryTracker.getRecommendations(
    problemSize,
    groups,
    groupSize,
    timeLimitMs
  );
  if (!recs || recs.length === 0) return candidates;

  const scoreByAlg = new Map<string, number>();
  for (const r of recs) {
    const alg = r.algorithm.toLowerCase();
    scoreByAlg.set(alg, Math.max(scoreByAlg.get(alg) ?? 0, r.confidence));
  }

  const [first, ...rest] = candidates;
  const sorted = rest.slice().sort((a, b) => {
    const sa = scoreByAlg.get(a) ?? 0;
    const sb = scoreByAlg.get(b) ?? 0;
    return sb - sa;
  });
  return [first, ...sorted];
}

/**
 * Utility function to create items from an array of capacities
 * @param capacities Array of capacity values
 * @param idPrefix Optional prefix for generated IDs
 * @returns Array of Item objects
 * @example
 * const items = fromCapacities([12.3, 5.1, 7.7], 'node_');
 * // items => [{ id: 'node_0', capacity: 12.3 }, ...]
 */
export function fromCapacities(
  capacities: number[],
  idPrefix: string = 'item'
): Item[] {
  return capacities.map((capacity, index) => ({
    id: `${idPrefix}${index}`,
    capacity,
  }));
}

/**
 * Re-export key functions and types for public API
 */
export type {
  // Types
  Item,
  PartitionOptions,
  Grouping,
} from './types.js';

export {
  // Validation functions
  assertUniqueIds,
  isFeasible,
} from './validation.js';

export {
  // Error types
  ValidationError,
  AlgorithmError,
  TimeoutError,
  InfeasibleError,
  ConfigurationError,
  NumericalError,
  MemoryError,
  UnsupportedError,
} from './errors.js';

// Export individual algorithms for advanced users
export { roundRobin } from './algorithms/roundrobin.js';
export { lpt } from './algorithms/lpt.js';
export { evaluateGrouping } from './algorithms/evaluate.js';
export { kk } from './algorithms/kk.js';
