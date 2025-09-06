import { PerformanceMetrics } from './performance.js';
import { PerformanceThresholds } from './performance.js';

export interface EarlyTerminationConfig {
  enabled: boolean;
  checkInterval: number; // How often to check (in iterations)
  maxExecutionTimeMs: number;
  maxIterations: number;
  maxMemoryUsageMB: number;
  performanceDegradationThreshold: number; // Stop if performance degrades by this factor
  adaptiveThresholds: boolean; // Adjust thresholds based on historical performance
}

export interface TerminationReason {
  reason: 'time-limit' | 'iteration-limit' | 'memory-limit' | 'performance-degradation' | 'threshold-exceeded';
  message: string;
  metrics: PerformanceMetrics;
  threshold: string;
  actual: number;
  limit: number;
}

/**
 * Early termination system that monitors algorithm execution and stops
 * when performance thresholds are exceeded or performance degrades.
 */
export class EarlyTerminationMonitor {
  private config: EarlyTerminationConfig;
  private startTime: number = 0;
  private startMemory?: number;
  private lastCheckTime: number = 0;
  private lastCheckIterations: number = 0;
  private performanceHistory: PerformanceMetrics[] = [];
  private adaptiveThresholds: Map<string, number> = new Map();

  constructor(config: Partial<EarlyTerminationConfig> = {}) {
    this.config = {
      enabled: true,
      checkInterval: 100,
      maxExecutionTimeMs: 30000, // 30 seconds
      maxIterations: 1000000,
      maxMemoryUsageMB: 1024, // 1GB
      performanceDegradationThreshold: 0.5, // 50% degradation
      adaptiveThresholds: true,
      ...config,
    };
  }

  /**
   * Start monitoring for early termination
   */
  startMonitoring(): void {
    this.startTime = Date.now();
    this.lastCheckTime = this.startTime;
    this.lastCheckIterations = 0;
    this.performanceHistory = [];
    
    const mem = (performance as any)?.memory?.usedJSHeapSize;
    if (typeof mem === 'number') {
      this.startMemory = mem / (1024 * 1024);
    }
  }

  /**
   * Check if execution should be terminated early
   */
  shouldTerminate(
    currentIterations: number,
    currentMetrics?: Partial<PerformanceMetrics>
  ): TerminationReason | null {
    if (!this.config.enabled) {
      return null;
    }

    const now = Date.now();
    const currentTime = now - this.startTime;

    // Check if it's time to perform a check
    if (currentIterations - this.lastCheckIterations < this.config.checkInterval) {
      return null;
    }

    this.lastCheckTime = now;
    this.lastCheckIterations = currentIterations;

    // Check execution time limit
    if (currentTime > this.config.maxExecutionTimeMs) {
      return {
        reason: 'time-limit',
        message: `Execution time limit exceeded: ${currentTime}ms > ${this.config.maxExecutionTimeMs}ms`,
        metrics: this.createMetrics(currentIterations, currentTime),
        threshold: 'maxExecutionTimeMs',
        actual: currentTime,
        limit: this.config.maxExecutionTimeMs,
      };
    }

    // Check iteration limit
    if (currentIterations > this.config.maxIterations) {
      return {
        reason: 'iteration-limit',
        message: `Iteration limit exceeded: ${currentIterations} > ${this.config.maxIterations}`,
        metrics: this.createMetrics(currentIterations, currentTime),
        threshold: 'maxIterations',
        actual: currentIterations,
        limit: this.config.maxIterations,
      };
    }

    // Check memory usage limit
    const used = (performance as any)?.memory?.usedJSHeapSize;
    if (this.startMemory && typeof used === 'number') {
      const currentMemory = used / (1024 * 1024);
      const memoryIncrease = currentMemory - this.startMemory;
      
      if (memoryIncrease > this.config.maxMemoryUsageMB) {
        return {
          reason: 'memory-limit',
          message: `Memory usage limit exceeded: ${memoryIncrease.toFixed(2)}MB > ${this.config.maxMemoryUsageMB}MB`,
          metrics: this.createMetrics(currentIterations, currentTime, currentMemory),
          threshold: 'maxMemoryUsageMB',
          actual: memoryIncrease,
          limit: this.config.maxMemoryUsageMB,
        };
      }
    }

    // Check performance degradation
    if (currentMetrics && this.config.performanceDegradationThreshold > 0) {
      const degradationReason = this.checkPerformanceDegradation(currentMetrics, currentIterations, currentTime);
      if (degradationReason) {
        return degradationReason;
      }
    }

    // Check adaptive thresholds
    if (this.config.adaptiveThresholds) {
      const adaptiveReason = this.checkAdaptiveThresholds(currentIterations, currentTime);
      if (adaptiveReason) {
        return adaptiveReason;
      }
    }

    return null;
  }

  /**
   * Check if performance is degrading significantly
   */
  private checkPerformanceDegradation(
    currentMetrics: Partial<PerformanceMetrics>,
    currentIterations: number,
    currentTime: number
  ): TerminationReason | null {
    if (this.performanceHistory.length < 2) {
      return null;
    }

    // Calculate performance metrics for current state
    const currentPerformance = this.calculatePerformanceMetric(currentMetrics, currentIterations, currentTime);
    
    // Get recent performance history
    const recentHistory = this.performanceHistory.slice(-5); // Last 5 measurements
    const avgRecentPerformance = recentHistory.reduce((sum, m) => sum + this.calculatePerformanceMetric(m, m.iterations, m.executionTimeMs), 0) / recentHistory.length;

    // Check if current performance is significantly worse
    if (currentPerformance < avgRecentPerformance * (1 - this.config.performanceDegradationThreshold)) {
      return {
        reason: 'performance-degradation',
        message: `Performance degradation detected: current ${currentPerformance.toFixed(3)} vs average ${avgRecentPerformance.toFixed(3)}`,
        metrics: this.createMetrics(currentIterations, currentTime),
        threshold: 'performanceDegradationThreshold',
        actual: currentPerformance,
        limit: avgRecentPerformance * (1 - this.config.performanceDegradationThreshold),
      };
    }

    return null;
  }

  /**
   * Check adaptive thresholds based on historical performance
   */
  private checkAdaptiveThresholds(
    currentIterations: number,
    currentTime: number
  ): TerminationReason | null {
    if (this.performanceHistory.length < 3) {
      return null;
    }

    // Calculate expected performance based on history
    const expectedTimePerIteration = this.performanceHistory.reduce((sum, m) => sum + m.executionTimeMs / Math.max(m.iterations, 1), 0) / this.performanceHistory.length;
    const expectedTime = expectedTimePerIteration * currentIterations;

    // If current time is significantly higher than expected, terminate
    if (currentTime > expectedTime * 2) { // 2x expected time
      return {
        reason: 'threshold-exceeded',
        message: `Execution time significantly exceeds expected: ${currentTime}ms vs expected ${expectedTime.toFixed(0)}ms`,
        metrics: this.createMetrics(currentIterations, currentTime),
        threshold: 'adaptiveThresholds',
        actual: currentTime,
        limit: expectedTime * 2,
      };
    }

    return null;
  }

  /**
   * Calculate a performance metric (higher is better)
   */
  private calculatePerformanceMetric(
    metrics: Partial<PerformanceMetrics>,
    iterations: number,
    executionTimeMs: number
  ): number {
    if (executionTimeMs === 0 || iterations === 0) {
      return 0;
    }

    // Combine multiple factors: iterations per second, memory efficiency, etc.
    const iterationsPerSecond = iterations / (executionTimeMs / 1000);
    const timeEfficiency = 1 / (1 + executionTimeMs / 1000); // Normalize to seconds
    
    // If we have delta information, include balance quality (optional field)
    let balanceQuality = 1.0;
    const anyMetrics = metrics as any;
    if (typeof anyMetrics.delta === 'number') {
      balanceQuality = 1 / (1 + anyMetrics.delta / 100); // Normalize delta
    }

    return (iterationsPerSecond * timeEfficiency * balanceQuality) / 3;
  }

  /**
   * Create performance metrics object
   */
  private createMetrics(
    iterations: number,
    executionTimeMs: number,
    memoryUsageMB?: number
  ): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      executionTimeMs,
      memoryUsageMB,
      iterations,
      algorithm: 'unknown',
      problemSize: 0,
      groups: 0,
      groupSize: 0,
      timestamp: Date.now(),
      success: false,
    };

    return metrics;
  }

  /**
   * Update performance history with current metrics
   */
  updatePerformanceHistory(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    
    // Keep only recent history to prevent memory bloat
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    elapsedTimeMs: number;
    startTime: number;
    startMemoryMB?: number;
  } {
    const elapsedTimeMs = Date.now() - this.startTime;
    return {
      isMonitoring: this.startTime > 0,
      elapsedTimeMs,
      startTime: this.startTime,
      startMemoryMB: this.startMemory,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EarlyTerminationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): EarlyTerminationConfig {
    return { ...this.config };
  }

  /**
   * Reset monitoring state
   */
  reset(): void {
    this.startTime = 0;
    this.startMemory = undefined;
    this.lastCheckTime = 0;
    this.lastCheckIterations = 0;
    this.performanceHistory = [];
    this.adaptiveThresholds.clear();
  }

  /**
   * Get performance history for analysis
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Set adaptive thresholds for specific algorithms
   */
  setAdaptiveThreshold(algorithm: string, threshold: number): void {
    this.adaptiveThresholds.set(algorithm, threshold);
  }

  /**
   * Get adaptive threshold for an algorithm
   */
  getAdaptiveThreshold(algorithm: string): number | undefined {
    return this.adaptiveThresholds.get(algorithm);
  }
}

// Global early termination monitor instance
export const globalEarlyTerminationMonitor = new EarlyTerminationMonitor();

/**
 * Decorator function that adds early termination monitoring to any function
 */
export function withEarlyTermination<T extends any[], R>(
  config: Partial<EarlyTerminationConfig> = {}
): (target: (...args: T) => R) => (...args: T) => R {
  return function(target: (...args: T) => R) {
    return function(this: any, ...args: T): R {
      const monitor = new EarlyTerminationMonitor(config);
      monitor.startMonitoring();
      
      // For synchronous functions, we can't easily check during execution
      // This is mainly useful for functions that accept iteration callbacks
      const result = target.apply(this, args);
      
      // Check one final time
      const terminationReason = monitor.shouldTerminate(0);
      if (terminationReason) {
        console.warn('Early termination check after execution:', terminationReason.message);
      }
      
      return result;
    };
  };
}

/**
 * Higher-order function that wraps a function with early termination
 */
export function wrapWithEarlyTermination<T extends any[], R>(
  fn: (...args: T) => R,
  config: Partial<EarlyTerminationConfig> = {}
): (...args: T) => R {
  const monitor = new EarlyTerminationMonitor(config);
  
  return function(this: any, ...args: T): R {
    monitor.startMonitoring();
    
    // For synchronous functions, we can only check at the end
    const result = fn.apply(this, args);
    
    // Check one final time
    const terminationReason = monitor.shouldTerminate(0);
    if (terminationReason) {
      console.warn('Early termination check after execution:', terminationReason.message);
    }
    
    return result;
  };
}
