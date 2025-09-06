import { Item, PartitionOptions, Grouping, NormalizedOptions } from './types.js';
import {
  AlgorithmError,
  TimeoutError,
  MemoryError,
  NumericalError,
} from './errors.js';

/**
 * Recovery strategy for algorithm failures
 */
export interface RecoveryStrategy {
  /** Name of the recovery strategy */
  name: string;
  /** Whether this strategy can handle the specific error */
  canHandle: (error: Error) => boolean;
  /** Execute the recovery strategy */
  recover: (
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    originalError: Error
  ) => Grouping | null;
}

/**
 * Fallback to simpler algorithm when complex algorithm fails
 */
export class SimplerAlgorithmFallback implements RecoveryStrategy {
  name = 'SimplerAlgorithmFallback';

  canHandle(error: Error): boolean {
    return (
      error instanceof AlgorithmError ||
      error instanceof TimeoutError ||
      error instanceof MemoryError ||
      error instanceof NumericalError
    );
  }

  recover(
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    originalError: Error
  ): Grouping | null {
    // Define fallback chain from complex to simple algorithms
    const fallbackChain: Array<PartitionOptions['method']> = [
      'lpt',
      'roundrobin',
    ];

    // Remove the failed method from the chain
    const currentMethod = options.method;
    const availableFallbacks = fallbackChain.filter(
      method => method !== currentMethod
    );

    for (const _ of availableFallbacks) {
      try {
        // Import the algorithm dynamically to avoid circular dependencies
        // This would be implemented when we have the actual algorithms
        // For now, return null to indicate recovery failed
        return null;
      } catch (fallbackError) {
        // Continue to next fallback
        continue;
      }
    }

    return null;
  }
}

/**
 * Reduce problem size when memory or performance issues occur
 */
export class ProblemSizeReduction implements RecoveryStrategy {
  name = 'ProblemSizeReduction';

  canHandle(error: Error): boolean {
    return error instanceof MemoryError || error instanceof TimeoutError;
  }

  recover(
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    originalError: Error
  ): Grouping | null {
    // For very large problems, try to use a more aggressive time limit
    // or switch to a heuristic approach
    try {
      // This would call the actual algorithm when implemented
      // For now, return null
      return null;
    } catch (recoveryError) {
      return null;
    }
  }
}

/**
 * Numerical precision recovery for floating-point issues
 */
export class NumericalPrecisionRecovery implements RecoveryStrategy {
  name = 'NumericalPrecisionRecovery';

  canHandle(error: Error): boolean {
    return error instanceof NumericalError;
  }

  recover(
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    originalError: Error
  ): Grouping | null {
    try {
      // Scale capacities to avoid precision issues
      const scaleFactor = this.calculateScaleFactor(items);

      // This would call the actual algorithm when implemented
      // For now, return null
      return null;
    } catch (recoveryError) {
      return null;
    }
  }

  private calculateScaleFactor(items: Item[]): number {
    // Find the smallest non-zero decimal precision needed
    let maxDecimalPlaces = 0;

    for (const item of items) {
      const str = item.capacity.toString();
      const decimalIndex = str.indexOf('.');
      if (decimalIndex !== -1) {
        const decimalPlaces = str.length - decimalIndex - 1;
        maxDecimalPlaces = Math.max(maxDecimalPlaces, decimalPlaces);
      }
    }

    // Return a scale factor that converts to integers
    return Math.pow(10, Math.min(maxDecimalPlaces, 6)); // Cap at 6 decimal places
  }
}

/**
 * Timeout recovery with reduced complexity
 */
export class TimeoutRecovery implements RecoveryStrategy {
  name = 'TimeoutRecovery';

  canHandle(error: Error): boolean {
    return error instanceof TimeoutError;
  }

  recover(
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    originalError: Error
  ): Grouping | null {
    try {
      // This would call the actual algorithm when implemented
      // For now, return null
      return null;
    } catch (recoveryError) {
      return null;
    }
  }
}

/**
 * Recovery manager that coordinates different recovery strategies
 */
export class RecoveryManager {
  private strategies: RecoveryStrategy[] = [
    new NumericalPrecisionRecovery(),
    new ProblemSizeReduction(),
    new TimeoutRecovery(),
    new SimplerAlgorithmFallback(),
  ];

  /**
   * Attempt to recover from an algorithm failure
   * @param items Original items array
   * @param groups Number of groups
   * @param groupSize Items per group
   * @param options Original options
   * @param error The error that occurred
   * @returns Recovered result or null if recovery failed
   */
  recover(
    items: Item[],
    groups: number,
    groupSize: number,
    options: NormalizedOptions,
    error: Error
  ): Grouping | null {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          const result = strategy.recover(
            items,
            groups,
            groupSize,
            options,
            error
          );
          if (result !== null) {
            // Add recovery information to the result
            return {
              ...result,
              methodUsed: `${result.methodUsed} (recovered via ${strategy.name})`,
            };
          }
        } catch (recoveryError) {
          // Recovery strategy failed, try next one
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Add a custom recovery strategy
   * @param strategy Custom recovery strategy
   */
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.unshift(strategy); // Add to beginning for priority
  }

  /**
   * Remove a recovery strategy by name
   * @param name Name of the strategy to remove
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name);
  }
}

/**
 * Default recovery manager instance
 */
export const defaultRecoveryManager = new RecoveryManager();

/**
 * Utility function to create a graceful degradation result
 * when all recovery attempts fail
 */
export function createGracefulDegradation(
  items: Item[],
  groups: number,
  groupSize: number,
  originalError: Error
): Grouping {
  // Create a simple round-robin assignment as last resort
  const groupsById: (string | number)[][] = Array.from(
    { length: groups },
    () => []
  );
  const groupsByIndex: number[][] = Array.from({ length: groups }, () => []);
  const groupSums: number[] = new Array(groups).fill(0);

  // Sort items by capacity (descending) for better balance
  const sortedItems = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.capacity - a.item.capacity);

  // Distribute items round-robin
  for (let i = 0; i < sortedItems.length; i++) {
    const groupIndex = i % groups;
    const { item, index } = sortedItems[i]!;

    groupsById[groupIndex]!.push(item.id);
    groupsByIndex[groupIndex]!.push(index);
    groupSums[groupIndex]! += item.capacity;
  }

  const maxSum = Math.max(...groupSums);
  const minSum = Math.min(...groupSums);
  const delta = maxSum - minSum;

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
    methodUsed: 'graceful-degradation',
  };
}
