import { PerformanceMetrics } from './performance.js';

export interface AlgorithmPerformance {
  algorithm: string;
  totalRuns: number;
  successfulRuns: number;
  averageExecutionTime: number;
  averageIterations: number;
  averageDelta: number;
  averageStdev: number;
  successRate: number;
  lastUsed: number;
  performanceScore: number;
}

export interface PerformanceHistoryEntry {
  timestamp: number;
  problemSize: number;
  groups: number;
  groupSize: number;
  algorithm: string;
  executionTimeMs: number;
  iterations: number;
  delta: number;
  stdev: number;
  success: boolean;
  errorMessage?: string;
}

export interface PerformanceRecommendation {
  algorithm: string;
  confidence: number;
  reasoning: string[];
  expectedPerformance: {
    executionTimeMs: number;
    delta: number;
    successRate: number;
  };
}

/**
 * Performance history tracking system for dynamic algorithm selection.
 * Maintains historical performance data and provides intelligent recommendations.
 */
export class PerformanceHistoryTracker {
  private history: PerformanceHistoryEntry[] = [];
  private maxHistorySize: number = 10000; // Prevent unlimited growth

  /**
   * Add a performance entry to the history
   */
  addEntry(entry: Omit<PerformanceHistoryEntry, 'timestamp'>): void {
    const historyEntry: PerformanceHistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.history.push(historyEntry);

    // Maintain history size limit
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get performance statistics for a specific algorithm
   */
  getAlgorithmPerformance(algorithm: string): AlgorithmPerformance | null {
    const algorithmEntries = this.history.filter(entry => entry.algorithm === algorithm);
    
    if (algorithmEntries.length === 0) {
      return null;
    }

    const totalRuns = algorithmEntries.length;
    const successfulRuns = algorithmEntries.filter(entry => entry.success).length;
    const successRate = successfulRuns / totalRuns;

    const successfulEntries = algorithmEntries.filter(entry => entry.success);
    
    const averageExecutionTime = successfulEntries.reduce((sum, entry) => sum + entry.executionTimeMs, 0) / Math.max(successfulEntries.length, 1);
    const averageIterations = successfulEntries.reduce((sum, entry) => sum + entry.iterations, 0) / Math.max(successfulEntries.length, 1);
    const averageDelta = successfulEntries.reduce((sum, entry) => sum + entry.delta, 0) / Math.max(successfulEntries.length, 1);
    const averageStdev = successfulEntries.reduce((sum, entry) => sum + entry.stdev, 0) / Math.max(successfulEntries.length, 1);

    const lastUsed = Math.max(...algorithmEntries.map(entry => entry.timestamp));

    // Calculate performance score (higher is better)
    const timeScore = 1 / (1 + averageExecutionTime / 1000); // Normalize to seconds
    const deltaScore = 1 / (1 + averageDelta / 100); // Normalize delta
    const successScore = successRate;
    const performanceScore = (timeScore + deltaScore + successScore) / 3;

    return {
      algorithm,
      totalRuns,
      successfulRuns,
      averageExecutionTime,
      averageIterations,
      averageDelta,
      averageStdev,
      successRate,
      lastUsed,
      performanceScore,
    };
  }

  /**
   * Get performance statistics for all algorithms
   */
  getAllAlgorithmPerformance(): Map<string, AlgorithmPerformance> {
    const algorithms = new Set(this.history.map(entry => entry.algorithm));
    const performanceMap = new Map<string, AlgorithmPerformance>();

    for (const algorithm of algorithms) {
      const performance = this.getAlgorithmPerformance(algorithm);
      if (performance) {
        performanceMap.set(algorithm, performance);
      }
    }

    return performanceMap;
  }

  /**
   * Get performance recommendations for a specific problem
   */
  getRecommendations(
    problemSize: number,
    groups: number,
    groupSize: number,
    timeBudgetMs?: number
  ): PerformanceRecommendation[] {
    if (this.history.length === 0) {
      return [];
    }

    // Find similar problems in history
    const similarProblems = this.history.filter(entry => 
      Math.abs(entry.problemSize - problemSize) <= Math.max(5, problemSize * 0.1) &&
      Math.abs(entry.groups - groups) <= Math.max(1, groups * 0.2) &&
      Math.abs(entry.groupSize - groupSize) <= Math.max(1, groupSize * 0.2)
    );

    if (similarProblems.length === 0) {
      return [];
    }

    // Group by algorithm and calculate performance metrics
    const algorithmStats = new Map<string, {
      count: number;
      avgTime: number;
      avgDelta: number;
      avgStdev: number;
      successRate: number;
      recentPerformance: number;
    }>();

    for (const entry of similarProblems) {
      const existing = algorithmStats.get(entry.algorithm);
      if (existing) {
        existing.count++;
        existing.avgTime = (existing.avgTime + entry.executionTimeMs) / 2;
        existing.avgDelta = (existing.avgDelta + entry.delta) / 2;
        existing.avgStdev = (existing.avgStdev + entry.stdev) / 2;
        existing.successRate = (existing.successRate + (entry.success ? 1 : 0)) / 2;
        
        // Weight recent performance more heavily
        const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
        const recencyWeight = Math.exp(-ageHours / 24); // Decay over 24 hours
        existing.recentPerformance = (existing.recentPerformance + (entry.success ? 1 : 0) * recencyWeight) / 2;
      } else {
        const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
        const recencyWeight = Math.exp(-ageHours / 24);
        
        algorithmStats.set(entry.algorithm, {
          count: 1,
          avgTime: entry.executionTimeMs,
          avgDelta: entry.delta,
          avgStdev: entry.stdev,
          successRate: entry.success ? 1 : 0,
          recentPerformance: entry.success ? recencyWeight : 0,
        });
      }
    }

    // Convert to recommendations
    const recommendations: PerformanceRecommendation[] = [];
    
    for (const [algorithm, stats] of algorithmStats) {
      // Skip algorithms with very low success rate
      if (stats.successRate < 0.3) {
        continue;
      }

      // Skip algorithms that exceed time budget
      if (timeBudgetMs && stats.avgTime > timeBudgetMs * 1.5) {
        continue;
      }

      // Calculate confidence based on number of samples and recency
      const sampleConfidence = Math.min(0.8, stats.count / 10);
      const recencyConfidence = Math.min(0.6, stats.recentPerformance);
      const confidence = (sampleConfidence + recencyConfidence) / 2;

      // Generate reasoning
      const reasoning: string[] = [];
      reasoning.push(`${stats.count} historical runs`);
      reasoning.push(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
      reasoning.push(`Average time: ${stats.avgTime.toFixed(2)}ms`);
      reasoning.push(`Average delta: ${stats.avgDelta.toFixed(2)}`);
      
      if (stats.recentPerformance > 0.5) {
        reasoning.push('Good recent performance');
      }

      recommendations.push({
        algorithm,
        confidence,
        reasoning,
        expectedPerformance: {
          executionTimeMs: stats.avgTime,
          delta: stats.avgDelta,
          successRate: stats.successRate,
        },
      });
    }

    // Sort by confidence and performance
    recommendations.sort((a, b) => {
      // Primary sort by confidence
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      
      // Secondary sort by expected performance (faster and more balanced)
      const aScore = 1 / (1 + a.expectedPerformance.executionTimeMs / 1000) + 
                     1 / (1 + a.expectedPerformance.delta / 100);
      const bScore = 1 / (1 + b.expectedPerformance.executionTimeMs / 1000) + 
                     1 / (1 + b.expectedPerformance.delta / 100);
      
      return bScore - aScore;
    });

    return recommendations;
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(
    algorithm: string,
    timeWindowHours: number = 24
  ): {
    recentPerformance: number;
    historicalPerformance: number;
    trend: 'improving' | 'declining' | 'stable';
  } {
    const now = Date.now();
    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
    
    const recentEntries = this.history.filter(entry => 
      entry.algorithm === algorithm && 
      (now - entry.timestamp) <= timeWindowMs
    );
    
    const historicalEntries = this.history.filter(entry => 
      entry.algorithm === algorithm && 
      (now - entry.timestamp) > timeWindowMs
    );

    const recentSuccessRate = recentEntries.length > 0 
      ? recentEntries.filter(entry => entry.success).length / recentEntries.length 
      : 0;
    
    const historicalSuccessRate = historicalEntries.length > 0 
      ? historicalEntries.filter(entry => entry.success).length / historicalEntries.length 
      : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentSuccessRate > historicalSuccessRate + 0.1) {
      trend = 'improving';
    } else if (recentSuccessRate < historicalSuccessRate - 0.1) {
      trend = 'declining';
    }

    return {
      recentPerformance: recentSuccessRate,
      historicalPerformance: historicalSuccessRate,
      trend,
    };
  }

  /**
   * Get problem size performance analysis
   */
  getProblemSizeAnalysis(): {
    smallProblems: { [algorithm: string]: number }; // success rate
    mediumProblems: { [algorithm: string]: number };
    largeProblems: { [algorithm: string]: number };
  } {
    const smallProblems: { [algorithm: string]: number } = {};
    const mediumProblems: { [algorithm: string]: number } = {};
    const largeProblems: { [algorithm: string]: number } = {};

    const algorithms = new Set(this.history.map(entry => entry.algorithm));

    for (const algorithm of algorithms) {
      const entries = this.history.filter(entry => entry.algorithm === algorithm);
      
      // Small problems (≤20 items)
      const smallEntries = entries.filter(entry => entry.problemSize <= 20);
      if (smallEntries.length > 0) {
        smallProblems[algorithm] = smallEntries.filter(entry => entry.success).length / smallEntries.length;
      }

      // Medium problems (21-100 items)
      const mediumEntries = entries.filter(entry => entry.problemSize > 20 && entry.problemSize <= 100);
      if (mediumEntries.length > 0) {
        mediumProblems[algorithm] = mediumEntries.filter(entry => entry.success).length / mediumEntries.length;
      }

      // Large problems (>100 items)
      const largeEntries = entries.filter(entry => entry.problemSize > 100);
      if (largeEntries.length > 0) {
        largeProblems[algorithm] = largeEntries.filter(entry => entry.success).length / largeEntries.length;
      }
    }

    return { smallProblems, mediumProblems, largeProblems };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Export performance history as JSON
   */
  exportHistory(): string {
    return JSON.stringify({
      history: this.history,
      timestamp: new Date().toISOString(),
      totalEntries: this.history.length,
    }, null, 2);
  }

  /**
   * Import performance history from JSON
   */
  importHistory(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.history = parsed.history;
      }
    } catch (error) {
      console.warn('Failed to import performance history:', error);
    }
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size); // Minimum 1 entry
  }

  /**
   * Get maximum history size
   */
  getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
}

// Global performance history tracker instance
export const globalPerformanceHistoryTracker = new PerformanceHistoryTracker();
