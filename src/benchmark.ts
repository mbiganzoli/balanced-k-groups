import { Item, AlgorithmMethod } from './types.js';
import { partitionBalanced } from './index.js';
import { globalPerformanceMonitor, PerformanceMetrics } from './performance.js';

export interface BenchmarkResult {
  algorithm: string;
  problemSize: number;
  groups: number;
  groupSize: number;
  executionTimeMs: number;
  iterations: number;
  delta: number;
  stdev: number;
  success: boolean;
  errorMessage?: string;
}

export interface BenchmarkComparison {
  results: BenchmarkResult[];
  summary: {
    fastestAlgorithm: string;
    mostBalancedAlgorithm: string;
    mostEfficientAlgorithm: string;
    averageExecutionTime: number;
    averageDelta: number;
    totalRuns: number;
  };
}

export interface BenchmarkOptions {
  algorithms?: string[];
  problemSizes?: number[];
  groupCounts?: number[];
  groupSizes?: number[];
  iterations?: number;
  timeLimitMs?: number;
  seed?: number;
}

/**
 * Benchmark utility for comparing algorithm performance across different problem sizes and configurations.
 * Provides comprehensive performance analysis and recommendations.
 */
export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * Run benchmark for a single algorithm and problem configuration
   */
  async runSingleBenchmark(
    algorithm: string,
    items: Item[],
    groups: number,
    groupSize: number,
    options: { timeLimitMs?: number; seed?: number } = {}
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    
    try {
      const method = (algorithm as AlgorithmMethod | undefined) ?? 'auto';
      const result = await partitionBalanced(items, groups, groupSize, {
        method,
        timeLimitMs: options.timeLimitMs,
        seed: options.seed,
      });

      const executionTimeMs = performance.now() - startTime;
      
      const benchmarkResult: BenchmarkResult = {
        algorithm: method,
        problemSize: items.length,
        groups,
        groupSize,
        executionTimeMs,
        iterations: result.iterations || 0,
        delta: result.delta,
        stdev: result.stdev,
        success: true,
      };

      this.results.push(benchmarkResult);
      return benchmarkResult;
    } catch (error) {
      const executionTimeMs = performance.now() - startTime;
      
      const benchmarkResult: BenchmarkResult = {
        algorithm,
        problemSize: items.length,
        groups,
        groupSize,
        executionTimeMs,
        iterations: 0,
        delta: Infinity,
        stdev: Infinity,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      this.results.push(benchmarkResult);
      return benchmarkResult;
    }
  }

  /**
   * Generate synthetic test data for benchmarking
   */
  generateTestData(
    problemSize: number,
    capacityRange: [number, number] = [1, 100],
    seed?: number
  ): Item[] {
    const items: Item[] = [];
    let randState = (seed ?? 123456789) >>> 0;
    
    const rand = (): number => {
      randState = (1664525 * randState + 1013904223) >>> 0;
      return randState / 0xffffffff;
    };

    for (let i = 0; i < problemSize; i++) {
      const capacity = Math.floor(
        capacityRange[0] + rand() * (capacityRange[1] - capacityRange[0])
      );
      items.push({ id: `item_${i}` as const, capacity });
    }

    return items;
  }

  /**
   * Run comprehensive benchmark across multiple algorithms and problem sizes
   */
  async runComprehensiveBenchmark(options: BenchmarkOptions = {}): Promise<BenchmarkComparison> {
    const {
      algorithms = ['roundrobin', 'lpt', 'kk', 'dp', 'backtracking', 'flow', 'metaheuristic'],
      problemSizes = [10, 20, 50, 100],
      groupCounts = [2, 4, 8],
      groupSizes = [5, 10, 20],
      iterations = 3,
      timeLimitMs = 30000,
      seed = 42,
    } = options;

    this.results = [];

    for (const problemSize of problemSizes) {
      for (const groups of groupCounts) {
        for (const groupSize of groupSizes) {
          const totalItems = groups * groupSize;
          
          // Skip if problem size doesn't match group configuration
          if (totalItems !== problemSize) {
            continue;
          }

          // Generate test data
          const items = this.generateTestData(problemSize, [1, 100], seed);

          // Run each algorithm multiple times
          for (const algorithm of algorithms) {
            for (let i = 0; i < iterations; i++) {
              const runSeed = seed + i * 1000;
              await this.runSingleBenchmark(algorithm, items, groups, groupSize, {
                timeLimitMs,
                seed: runSeed,
              });
            }
          }
        }
      }
    }

    return this.generateComparison();
  }

  /**
   * Generate performance comparison summary
   */
  private generateComparison(): BenchmarkComparison {
    if (this.results.length === 0) {
      return {
        results: [],
        summary: {
          fastestAlgorithm: 'none',
          mostBalancedAlgorithm: 'none',
          mostEfficientAlgorithm: 'none',
          averageExecutionTime: 0,
          averageDelta: 0,
          totalRuns: 0,
        },
      };
    }

    // Group results by algorithm
    const algorithmResults = new Map<string, BenchmarkResult[]>();
    for (const result of this.results) {
      if (!algorithmResults.has(result.algorithm)) {
        algorithmResults.set(result.algorithm, []);
      }
      algorithmResults.get(result.algorithm)!.push(result);
    }

    // Calculate averages for each algorithm
    const algorithmStats = new Map<string, {
      avgTime: number;
      avgDelta: number;
      avgIterations: number;
      successRate: number;
      totalRuns: number;
    }>();

    for (const [algorithm, results] of algorithmResults) {
      const successfulResults = results.filter(r => r.success);
      const avgTime = successfulResults.reduce((sum, r) => sum + r.executionTimeMs, 0) / Math.max(successfulResults.length, 1);
      const avgDelta = successfulResults.reduce((sum, r) => sum + r.delta, 0) / Math.max(successfulResults.length, 1);
      const avgIterations = successfulResults.reduce((sum, r) => sum + r.iterations, 0) / Math.max(successfulResults.length, 1);
      const successRate = successfulResults.length / results.length;
      const totalRuns = results.length;

      algorithmStats.set(algorithm, {
        avgTime,
        avgDelta,
        avgIterations,
        successRate,
        totalRuns,
      });
    }

    // Find best algorithms in different categories
    let fastestAlgorithm = 'none';
    let mostBalancedAlgorithm = 'none';
    let mostEfficientAlgorithm = 'none';
    let bestTime = Infinity;
    let bestDelta = Infinity;
    let bestEfficiency = -Infinity;

    for (const [algorithm, stats] of algorithmStats) {
      if (stats.successRate > 0.5) { // Only consider algorithms with >50% success rate
        // Fastest
        if (stats.avgTime < bestTime) {
          bestTime = stats.avgTime;
          fastestAlgorithm = algorithm;
        }

        // Most balanced
        if (stats.avgDelta < bestDelta) {
          bestDelta = stats.avgDelta;
          mostBalancedAlgorithm = algorithm;
        }

        // Most efficient (balance vs time trade-off)
        const efficiency = 1 / (1 + stats.avgDelta) / (1 + stats.avgTime / 1000);
        if (efficiency > bestEfficiency) {
          bestEfficiency = efficiency;
          mostEfficientAlgorithm = algorithm;
        }
      }
    }

    // Calculate overall averages
    const allSuccessful = this.results.filter(r => r.success);
    const averageExecutionTime = allSuccessful.reduce((sum, r) => sum + r.executionTimeMs, 0) / Math.max(allSuccessful.length, 1);
    const averageDelta = allSuccessful.reduce((sum, r) => sum + r.delta, 0) / Math.max(allSuccessful.length, 1);

    return {
      results: this.results,
      summary: {
        fastestAlgorithm,
        mostBalancedAlgorithm,
        mostEfficientAlgorithm,
        averageExecutionTime,
        averageDelta,
        totalRuns: this.results.length,
      },
    };
  }

  /**
   * Get benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Clear benchmark results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Export benchmark results as JSON
   */
  exportResults(): string {
    return JSON.stringify({
      results: this.results,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import benchmark results from JSON
   */
  importResults(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.results) {
        this.results = parsed.results;
      }
    } catch (error) {
      console.warn('Failed to import benchmark results:', error);
    }
  }

  /**
   * Generate performance recommendations based on benchmark results
   */
  getRecommendations(problemSize: number, groups: number, groupSize: number): {
    recommendedAlgorithm: string;
    confidence: number;
    reasoning: string[];
  } {
    if (this.results.length === 0) {
      return {
        recommendedAlgorithm: 'auto',
        confidence: 0,
        reasoning: ['No benchmark data available'],
      };
    }

    // Find similar problems in benchmark results
    const similarProblems = this.results.filter(r => 
      Math.abs(r.problemSize - problemSize) <= 10 &&
      Math.abs(r.groups - groups) <= 2 &&
      Math.abs(r.groupSize - groupSize) <= 5
    );

    if (similarProblems.length === 0) {
      return {
        recommendedAlgorithm: 'auto',
        confidence: 0.3,
        reasoning: ['No similar problems in benchmark data'],
      };
    }

    // Group by algorithm and calculate performance metrics
    const algorithmStats = new Map<string, {
      count: number;
      avgTime: number;
      avgDelta: number;
      successRate: number;
    }>();

    for (const result of similarProblems) {
      const existing = algorithmStats.get(result.algorithm);
      if (existing) {
        existing.count++;
        existing.avgTime = (existing.avgTime + result.executionTimeMs) / 2;
        existing.avgDelta = (existing.avgDelta + result.delta) / 2;
        existing.successRate = (existing.successRate + (result.success ? 1 : 0)) / 2;
      } else {
        algorithmStats.set(result.algorithm, {
          count: 1,
          avgTime: result.executionTimeMs,
          avgDelta: result.delta,
          successRate: result.success ? 1 : 0,
        });
      }
    }

    // Find best performing algorithm
    let bestAlgorithm = 'auto';
    let bestScore = -1;
    const reasoning: string[] = [];

    for (const [algorithm, stats] of algorithmStats) {
      // Score based on execution time, delta, and success rate
      const timeScore = 1 / (1 + stats.avgTime / 1000);
      const deltaScore = 1 / (1 + stats.avgDelta / 100);
      const successScore = stats.successRate;
      
      const totalScore = (timeScore + deltaScore + successScore) / 3;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAlgorithm = algorithm;
      }

      reasoning.push(`${algorithm}: ${stats.count} runs, ${stats.avgTime.toFixed(2)}ms avg, ${stats.avgDelta.toFixed(2)} delta, ${stats.successRate.toFixed(2)} success rate`);
    }

    const confidence = Math.min(0.9, 0.3 + (similarProblems.length * 0.05));

    return {
      recommendedAlgorithm: bestAlgorithm,
      confidence,
      reasoning,
    };
  }
}

// Global benchmark runner instance
export const globalBenchmarkRunner = new BenchmarkRunner();
