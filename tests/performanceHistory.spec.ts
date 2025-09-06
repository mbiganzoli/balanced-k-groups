import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceHistoryTracker, PerformanceHistoryEntry } from '../src/performanceHistory.js';

describe('PerformanceHistoryTracker', () => {
  let tracker: PerformanceHistoryTracker;

  beforeEach(() => {
    tracker = new PerformanceHistoryTracker();
  });

  it('adds performance entries correctly', () => {
    const entry: Omit<PerformanceHistoryEntry, 'timestamp'> = {
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: 15.5,
      iterations: 10,
      delta: 5.2,
      stdev: 2.1,
      success: true,
    };

    tracker.addEntry(entry);
    expect(tracker.getHistorySize()).toBe(1);
  });

  it('maintains history size limit', () => {
    const entry: Omit<PerformanceHistoryEntry, 'timestamp'> = {
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: 15.5,
      iterations: 10,
      delta: 5.2,
      stdev: 2.1,
      success: true,
    };

    // Set a small max size for testing
    tracker.setMaxHistorySize(3);

    // Add more entries than the limit
    for (let i = 0; i < 5; i++) {
      tracker.addEntry(entry);
    }

    expect(tracker.getHistorySize()).toBe(3);
    expect(tracker.getMaxHistorySize()).toBe(3);
  });

  it('gets algorithm performance statistics', () => {
    // Add multiple entries for roundrobin
    const entry1: Omit<PerformanceHistoryEntry, 'timestamp'> = {
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: 15.5,
      iterations: 10,
      delta: 5.2,
      stdev: 2.1,
      success: true,
    };

    const entry2: Omit<PerformanceHistoryEntry, 'timestamp'> = {
      problemSize: 20,
      groups: 4,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: 25.3,
      iterations: 15,
      delta: 8.1,
      stdev: 3.2,
      success: true,
    };

    const entry3: Omit<PerformanceHistoryEntry, 'timestamp'> = {
      problemSize: 15,
      groups: 3,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: 20.0,
      iterations: 12,
      delta: 6.5,
      stdev: 2.8,
      success: false,
    };

    tracker.addEntry(entry1);
    tracker.addEntry(entry2);
    tracker.addEntry(entry3);

    const performance = tracker.getAlgorithmPerformance('roundrobin');
    
    expect(performance).toBeDefined();
    expect(performance!.algorithm).toBe('roundrobin');
    expect(performance!.totalRuns).toBe(3);
    expect(performance!.successfulRuns).toBe(2);
    expect(performance!.successRate).toBeCloseTo(2/3, 2);
    expect(performance!.averageExecutionTime).toBeCloseTo((15.5 + 25.3) / 2, 1);
    expect(performance!.averageDelta).toBeCloseTo((5.2 + 8.1) / 2, 1);
    expect(performance!.performanceScore).toBeGreaterThan(0);
  });

  it('returns null for unknown algorithm', () => {
    const performance = tracker.getAlgorithmPerformance('unknown-algorithm');
    expect(performance).toBeNull();
  });

  it('gets all algorithm performance', () => {
    // Add entries for multiple algorithms
    const algorithms = ['roundrobin', 'lpt', 'kk'];
    
    for (const algorithm of algorithms) {
      tracker.addEntry({
        problemSize: 10,
        groups: 2,
        groupSize: 5,
        algorithm,
        executionTimeMs: 15.5,
        iterations: 10,
        delta: 5.2,
        stdev: 2.1,
        success: true,
      });
    }

    const allPerformance = tracker.getAllAlgorithmPerformance();
    expect(allPerformance.size).toBe(3);
    
    for (const algorithm of algorithms) {
      expect(allPerformance.has(algorithm)).toBe(true);
    }
  });

  it('provides performance recommendations', () => {
    // Add some historical data
    const algorithms = ['roundrobin', 'lpt', 'kk'];
    
    for (const algorithm of algorithms) {
      for (let i = 0; i < 5; i++) {
        tracker.addEntry({
          problemSize: 10 + i * 5,
          groups: 2,
          groupSize: 5 + i,
          algorithm,
          executionTimeMs: 15.5 + i * 2,
          iterations: 10 + i,
          delta: 5.2 + i * 0.5,
          stdev: 2.1 + i * 0.2,
          success: i < 4, // Some failures
        });
      }
    }

    const recommendations = tracker.getRecommendations(12, 2, 6);
    
    expect(recommendations.length).toBeGreaterThan(0);
    
    for (const rec of recommendations) {
      expect(rec.algorithm).toBeDefined();
      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(rec.reasoning.length).toBeGreaterThan(0);
      expect(rec.expectedPerformance).toBeDefined();
      expect(rec.expectedPerformance.executionTimeMs).toBeGreaterThan(0);
      expect(rec.expectedPerformance.delta).toBeGreaterThanOrEqual(0);
      expect(rec.expectedPerformance.successRate).toBeGreaterThan(0);
    }
  });

  it('handles recommendations for unknown problem sizes', () => {
    const recommendations = tracker.getRecommendations(1000, 100, 10);
    expect(recommendations).toHaveLength(0);
  });

  it('respects time budget in recommendations', () => {
    // Add data with different execution times
    tracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'fast-algo',
      executionTimeMs: 10,
      iterations: 5,
      delta: 3.0,
      stdev: 1.5,
      success: true,
    });

    tracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'slow-algo',
      executionTimeMs: 100,
      iterations: 50,
      delta: 1.0,
      stdev: 0.5,
      success: true,
    });

    const recommendations = tracker.getRecommendations(10, 2, 5, 50); // 50ms time budget
    
    // Should only include fast-algo (10ms < 50ms * 1.5 = 75ms)
    // slow-algo (100ms > 75ms) should be excluded
    expect(recommendations.length).toBe(1);
    expect(recommendations[0]!.algorithm).toBe('fast-algo');
  });

  it('tracks performance trends over time', () => {
    // Add historical data (older entries)
    const oldTimestamp = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
    
    // Simulate old entries by manually setting timestamps
    const oldEntry: PerformanceHistoryEntry = {
      timestamp: oldTimestamp,
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'test-algo',
      executionTimeMs: 20.0,
      iterations: 15,
      delta: 8.0,
      stdev: 3.0,
      success: true,
    };

    // Add old entry manually
    (tracker as any).history.push(oldEntry);

    // Add recent entry
    tracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'test-algo',
      executionTimeMs: 15.0,
      iterations: 10,
      delta: 5.0,
      stdev: 2.0,
      success: true,
    });

    const trends = tracker.getPerformanceTrends('test-algo', 24);
    
    expect(trends.recentPerformance).toBe(1.0); // 1/1 successful
    expect(trends.historicalPerformance).toBe(1.0); // 1/1 successful
    expect(trends.trend).toBe('stable'); // Both 100% success
  });

  it('analyzes problem size performance', () => {
    // Add data for different problem sizes
    const problemSizes = [10, 50, 150]; // Small, medium, large
    
    for (const problemSize of problemSizes) {
      tracker.addEntry({
        problemSize,
        groups: 2,
        groupSize: Math.ceil(problemSize / 2),
        algorithm: 'test-algo',
        executionTimeMs: problemSize * 2,
        iterations: problemSize,
        delta: problemSize * 0.5,
        stdev: problemSize * 0.2,
        success: problemSize <= 50, // Only small and medium succeed
      });
    }

    const analysis = tracker.getProblemSizeAnalysis();
    
    expect(analysis.smallProblems['test-algo']).toBe(1.0); // 100% success
    expect(analysis.mediumProblems['test-algo']).toBe(1.0); // 100% success
    expect(analysis.largeProblems['test-algo']).toBe(0.0); // 0% success
  });

  it('manages history correctly', () => {
    expect(tracker.getHistorySize()).toBe(0);
    
    tracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'test-algo',
      executionTimeMs: 15.5,
      iterations: 10,
      delta: 5.2,
      stdev: 2.1,
      success: true,
    });

    expect(tracker.getHistorySize()).toBe(1);
    
    tracker.clearHistory();
    expect(tracker.getHistorySize()).toBe(0);
  });

  it('exports and imports history correctly', () => {
    // Add some data
    tracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'test-algo',
      executionTimeMs: 15.5,
      iterations: 10,
      delta: 5.2,
      stdev: 2.1,
      success: true,
    });

    const exportedData = tracker.exportHistory();
    expect(exportedData).toContain('test-algo');
    expect(exportedData).toContain('"totalEntries": 1');

    // Clear and import
    tracker.clearHistory();
    expect(tracker.getHistorySize()).toBe(0);

    tracker.importHistory(exportedData);
    expect(tracker.getHistorySize()).toBe(1);
  });

  it('handles invalid import data gracefully', () => {
    const originalSize = tracker.getHistorySize();
    
    // Suppress console.warn for this test
    const originalWarn = console.warn;
    console.warn = () => {}; // Suppress warning
    
    // Try to import invalid data
    tracker.importHistory('invalid json');
    
    // Restore console.warn
    console.warn = originalWarn;
    
    // Should not change the history
    expect(tracker.getHistorySize()).toBe(originalSize);
  });

  it('sets and gets max history size', () => {
    const originalSize = tracker.getMaxHistorySize();
    
    tracker.setMaxHistorySize(500);
    expect(tracker.getMaxHistorySize()).toBe(500);
    
    // Test minimum size enforcement
    tracker.setMaxHistorySize(0);
    expect(tracker.getMaxHistorySize()).toBe(1); // Minimum enforced
  });
});
