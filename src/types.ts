/**
 * Represents an item with a unique identifier and capacity
 */
export interface Item {
  /** Unique identifier for the item */
  id: string | number;
  /** Positive decimal capacity of the item */
  capacity: number;
}

/**
 * Configuration options for partitioning algorithms
 */
export interface PartitionOptions {
  /** Algorithm method to use */
  method?:
    | 'auto'
    | 'lpt'
    | 'kk'
    | 'dp'
    | 'backtracking'
    | 'ilp'
    | 'metaheuristic'
    | 'flow'
    | 'roundrobin';
  /** Scaling factor for numerical precision (RESERVED - not yet implemented) */
  scale?: 'auto' | number;
  /** Maximum time limit in milliseconds */
  timeLimitMs?: number;
  /** Random seed for reproducible results */
  seed?: number;
  /** Maximum number of iterations */
  maxIters?: number;
  /** Number of threads to use (RESERVED - not yet implemented) */
  threads?: number;
  /** Tolerance for convergence */
  tolerance?: number;
  /** Early stopping delta threshold */
  earlyStopDelta?: number;
  /** Return intermediate results (RESERVED - not yet implemented) */
  returnIntermediate?: boolean;
  /** Algorithm-specific configuration */
  algorithmConfig?: AlgorithmConfig;
  /** Optional selection preferences for dynamic auto strategy */
  preferredAlgorithms?: AlgorithmMethod[];
  /** Algorithms that should not be used during selection */
  disallowedAlgorithms?: AlgorithmMethod[];
  /** Selection strategy preference */
  selectionStrategy?: 'speed' | 'quality' | 'balanced';
  /** Hybrid combination controls (e.g., post-refinement) */
  hybrid?: {
    enable?: boolean;
    refineIters?: number;
  };
  /** Allow placeholder algorithms (flow, ilp) in auto selection */
  allowPlaceholderAlgorithms?: boolean;
}

/**
 * Result of a partitioning operation
 */
export interface Grouping {
  /** Groups organized by item IDs */
  groupsById: (string | number)[][];
  /** Groups organized by item indices */
  groupsByIndex: number[][];
  /** Sum of capacities for each group */
  groupSums: number[];
  /** Delta between max and min group sums */
  delta: number;
  /** Standard deviation of group sums */
  stdev: number;
  /** Number of iterations performed (optional) */
  iterations?: number;
  /** Method that was actually used */
  methodUsed: string;
}

/**
 * Performance metrics for algorithm execution
 */
export interface PerformanceMetrics {
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes?: number;
  /** Number of iterations performed */
  iterations: number;
  /** Algorithm method used */
  method: string;
  /** Whether the algorithm completed successfully */
  completed: boolean;
  /** Reason for termination */
  terminationReason: 'completed' | 'timeout' | 'error' | 'early_stop';
}

/**
 * Algorithm-specific configuration options
 */
export interface AlgorithmConfig {
  /** LPT-specific options */
  lpt?: {
    useRefinement?: boolean;
    maxRefinementIters?: number;
  };
  /** KK-specific options */
  kk?: {
    useLocalOptimization?: boolean; // RESERVED - not yet implemented
    maxOptimizationIters?: number; // RESERVED - not yet implemented
  };
  /** DP-specific options */
  dp?: {
    useKahanSum?: boolean; // RESERVED - not yet implemented
    useMeetInMiddle?: boolean; // RESERVED - not yet implemented
    maxStateSize?: number; // RESERVED - not yet implemented
  };
  /** Backtracking-specific options */
  backtracking?: {
    usePruning?: boolean; // RESERVED - not yet implemented
    maxDepth?: number; // RESERVED - not yet implemented
  };
  /** Metaheuristic-specific options */
  metaheuristic?: {
    populationSize?: number;
    mutationRate?: number;
    crossoverRate?: number;
    coolingRate?: number;
    tabuListSize?: number;
  };
  /** ILP-specific options */
  ilp?: {
    solver?: 'glpk' | 'auto'; // RESERVED - not yet implemented
    timeLimit?: number; // RESERVED - not yet implemented
    mipGap?: number; // RESERVED - not yet implemented
  };
}

/**
 * Extended partition options with algorithm-specific configurations
 */
export interface ExtendedPartitionOptions extends PartitionOptions {
  /** Algorithm-specific configurations */
  algorithmConfig?: AlgorithmConfig;
}

/**
 * Type guard to check if an object is a valid Item
 */
export function isItem(obj: unknown): obj is Item {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'capacity' in obj &&
    (typeof (obj as Item).id === 'string' ||
      typeof (obj as Item).id === 'number') &&
    typeof (obj as Item).capacity === 'number' &&
    isFinite((obj as Item).capacity) &&
    (obj as Item).capacity > 0
  );
}

/**
 * Type guard to check if an array contains valid Items
 */
export function isItemArray(arr: unknown): arr is Item[] {
  return Array.isArray(arr) && arr.every(isItem);
}

/**
 * Utility type for algorithm method names
 */
export type AlgorithmMethod = NonNullable<PartitionOptions['method']>;

/**
 * Utility type for termination reasons
 */
export type TerminationReason = PerformanceMetrics['terminationReason'];

/**
 * Normalized options with all defaults applied and validated
 */
export interface NormalizedOptions {
  method: NonNullable<PartitionOptions['method']>;
  timeLimitMs: number;
  seed?: number;
  maxIters: number;
  tolerance: number;
  earlyStopDelta: number;
  preferredAlgorithms?: string[];
  disallowedAlgorithms?: string[];
  selectionStrategy?: 'speed' | 'quality' | 'balanced';
  hybrid?: {
    enable?: boolean;
    refineIters?: number;
  };
  allowPlaceholderAlgorithms: boolean;
}
