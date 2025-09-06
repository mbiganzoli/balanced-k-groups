export interface PerformanceMetrics {
  executionTimeMs: number;
  memoryUsageMB?: number;
  iterations: number;
  algorithm: string;
  problemSize: number;
  groups: number;
  groupSize: number;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
}

export interface PerformanceHistory {
  metrics: PerformanceMetrics[];
  totalRuns: number;
  averageExecutionTime: number;
  averageIterations: number;
  successRate: number;
}

export interface PerformanceThresholds {
  maxExecutionTimeMs: number;
  maxIterations: number;
  maxMemoryUsageMB: number;
  minSuccessRate: number;
}

/**
 * Performance monitoring and metrics collection system for balanced partitioning algorithms.
 * Tracks execution time, memory usage, iterations, and maintains performance history.
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds = {
    maxExecutionTimeMs: 30000, // 30 seconds
    maxIterations: 100000,
    maxMemoryUsageMB: 1024, // 1GB
    minSuccessRate: 0.8, // 80%
  };

  /**
   * Start performance monitoring for an algorithm run
   */
  startMonitoring(
    algorithm: string,
    problemSize: number,
    groups: number,
    groupSize: number
  ): { startTime: number; startMemory?: number } {
    const startTime = performance.now();
    let startMemory: number | undefined;

    const used = (performance as any)?.memory?.usedJSHeapSize;
    if (typeof used === 'number') {
      startMemory = used;
    }

    return { startTime, startMemory };
  }

  /**
   * Stop performance monitoring and record metrics
   */
  stopMonitoring(
    startData: { startTime: number; startMemory?: number },
    algorithm: string,
    problemSize: number,
    groups: number,
    groupSize: number,
    iterations: number,
    success: boolean,
    errorMessage?: string
  ): PerformanceMetrics {
    const endTime = performance.now();
    const executionTimeMs = endTime - startData.startTime;

    let memoryUsageMB: number | undefined;
    const used = (performance as any)?.memory?.usedJSHeapSize;
    if (startData.startMemory !== undefined && typeof used === 'number') {
      const endMemory = used;
      memoryUsageMB = (endMemory - startData.startMemory) / (1024 * 1024);
    }

    const metrics: PerformanceMetrics = {
      executionTimeMs,
      memoryUsageMB,
      iterations,
      algorithm,
      problemSize,
      groups,
      groupSize,
      timestamp: Date.now(),
      success,
      errorMessage,
    };

    this.metrics.push(metrics);
    return metrics;
  }

  /**
   * Get performance history for a specific algorithm
   */
  getAlgorithmHistory(algorithm: string): PerformanceHistory {
    const algorithmMetrics = this.metrics.filter(m => m.algorithm === algorithm);
    
    if (algorithmMetrics.length === 0) {
      return {
        metrics: [],
        totalRuns: 0,
        averageExecutionTime: 0,
        averageIterations: 0,
        successRate: 0,
      };
    }

    const totalRuns = algorithmMetrics.length;
    const successfulRuns = algorithmMetrics.filter(m => m.success).length;
    const successRate = successfulRuns / totalRuns;

    const averageExecutionTime = algorithmMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalRuns;
    const averageIterations = algorithmMetrics.reduce((sum, m) => sum + m.iterations, 0) / totalRuns;

    return {
      metrics: algorithmMetrics,
      totalRuns,
      averageExecutionTime,
      averageIterations,
      successRate,
    };
  }

  /**
   * Get overall performance statistics
   */
  getOverallStats(): PerformanceHistory {
    if (this.metrics.length === 0) {
      return {
        metrics: [],
        totalRuns: 0,
        averageExecutionTime: 0,
        averageIterations: 0,
        successRate: 0,
      };
    }

    const totalRuns = this.metrics.length;
    const successfulRuns = this.metrics.filter(m => m.success).length;
    const successRate = successfulRuns / totalRuns;

    const averageExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalRuns;
    const averageIterations = this.metrics.reduce((sum, m) => sum + m.iterations, 0) / totalRuns;

    return {
      metrics: this.metrics,
      totalRuns,
      averageExecutionTime,
      averageIterations,
      successRate,
    };
  }

  /**
   * Check if performance thresholds are exceeded
   */
  checkThresholds(metrics: PerformanceMetrics): {
    exceeded: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    if (metrics.executionTimeMs > this.thresholds.maxExecutionTimeMs) {
      violations.push(`Execution time ${metrics.executionTimeMs}ms exceeds limit ${this.thresholds.maxExecutionTimeMs}ms`);
    }

    if (metrics.iterations > this.thresholds.maxIterations) {
      violations.push(`Iterations ${metrics.iterations} exceeds limit ${this.thresholds.maxIterations}`);
    }

    if (metrics.memoryUsageMB && metrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB) {
      violations.push(`Memory usage ${metrics.memoryUsageMB}MB exceeds limit ${this.thresholds.maxMemoryUsageMB}MB`);
    }

    return {
      exceeded: violations.length > 0,
      violations,
    };
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.metrics = [];
  }

  /**
   * Export performance data as JSON
   */
  exportData(): string {
    return JSON.stringify({
      thresholds: this.thresholds,
      metrics: this.metrics,
      overallStats: this.getOverallStats(),
    }, null, 2);
  }

  /**
   * Import performance data from JSON
   */
  importData(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.thresholds) {
        this.thresholds = parsed.thresholds;
      }
      if (parsed.metrics) {
        this.metrics = parsed.metrics;
      }
    } catch (error) {
      console.warn('Failed to import performance data:', error);
    }
  }

  /**
   * Get performance recommendations based on history
   */
  getRecommendations(problemSize: number, groups: number, groupSize: number): {
    recommendedAlgorithm: string;
    confidence: number;
    reasoning: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        recommendedAlgorithm: 'auto',
        confidence: 0,
        reasoning: ['No performance history available'],
      };
    }

    // Find similar problems in history
    const similarProblems = this.metrics.filter(m => 
      Math.abs(m.problemSize - problemSize) <= 5 &&
      Math.abs(m.groups - groups) <= 2 &&
      Math.abs(m.groupSize - groupSize) <= 2
    );

    if (similarProblems.length === 0) {
      return {
        recommendedAlgorithm: 'auto',
        confidence: 0.3,
        reasoning: ['No similar problems in history'],
      };
    }

    // Group by algorithm and calculate average performance
    const algorithmStats = new Map<string, {
      count: number;
      avgTime: number;
      avgIterations: number;
      successRate: number;
    }>();

    for (const metric of similarProblems) {
      const existing = algorithmStats.get(metric.algorithm);
      if (existing) {
        existing.count++;
        existing.avgTime = (existing.avgTime + metric.executionTimeMs) / 2;
        existing.avgIterations = (existing.avgIterations + metric.iterations) / 2;
        existing.successRate = (existing.successRate + (metric.success ? 1 : 0)) / 2;
      } else {
        algorithmStats.set(metric.algorithm, {
          count: 1,
          avgTime: metric.executionTimeMs,
          avgIterations: metric.iterations,
          successRate: metric.success ? 1 : 0,
        });
      }
    }

    // Find best performing algorithm
    let bestAlgorithm = 'auto';
    let bestScore = -1;
    const reasoning: string[] = [];

    for (const [algorithm, stats] of algorithmStats) {
      // Score based on execution time, iterations, and success rate
      const timeScore = 1 / (1 + stats.avgTime / 1000); // Normalize to seconds
      const iterationScore = 1 / (1 + stats.avgIterations / 1000);
      const successScore = stats.successRate;
      
      const totalScore = (timeScore + iterationScore + successScore) / 3;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAlgorithm = algorithm;
      }

      reasoning.push(`${algorithm}: ${stats.count} runs, ${stats.avgTime.toFixed(2)}ms avg, ${stats.successRate.toFixed(2)} success rate`);
    }

    const confidence = Math.min(0.9, 0.3 + (similarProblems.length * 0.1));

    return {
      recommendedAlgorithm: bestAlgorithm,
      confidence,
      reasoning,
    };
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();

/**
 * Performance monitoring decorator for functions
 */
export function monitorPerformance<T extends any[], R>(
  algorithm: string,
  target: (...args: T) => R
): (...args: T) => R {
  return function(this: any, ...args: T): R {
    const problemSize = args[0]?.length || 0;
    const groups = args[1] || 0;
    const groupSize = args[2] || 0;

    const startData = globalPerformanceMonitor.startMonitoring(algorithm, problemSize, groups, groupSize);
    
    try {
      const result = target.apply(this, args);
      
      // For async functions, we need to handle them differently
      if (result instanceof Promise) {
        return result.then(
          (res) => {
            globalPerformanceMonitor.stopMonitoring(
              startData,
              algorithm,
              problemSize,
              groups,
              groupSize,
              0, // Iterations not available for async functions
              true
            );
            return res;
          },
          (error) => {
            globalPerformanceMonitor.stopMonitoring(
              startData,
              algorithm,
              problemSize,
              groups,
              groupSize,
              0,
              false,
              error.message
            );
            throw error;
          }
        ) as R;
      }
      
      globalPerformanceMonitor.stopMonitoring(
        startData,
        algorithm,
        problemSize,
        groups,
        groupSize,
        0, // Iterations not available for decorated functions
        true
      );
      
      return result;
    } catch (error) {
      globalPerformanceMonitor.stopMonitoring(
        startData,
        algorithm,
        problemSize,
        groups,
        groupSize,
        0,
        false,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  };
}
