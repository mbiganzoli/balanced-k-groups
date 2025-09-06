import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor, PerformanceMetrics, monitorPerformance, globalPerformanceMonitor } from '../src/performance.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it('tracks execution time correctly', () => {
    const startData = monitor.startMonitoring('test-algorithm', 10, 2, 5);
    
    // Simulate some work
    const startTime = performance.now();
    while (performance.now() - startTime < 5) {
      // Busy wait for ~5ms
    }
    
    const metrics = monitor.stopMonitoring(
      startData,
      'test-algorithm',
      10,
      2,
      5,
      100,
      true
    );

    expect(metrics.executionTimeMs).toBeGreaterThan(0);
    expect(metrics.algorithm).toBe('test-algorithm');
    expect(metrics.problemSize).toBe(10);
    expect(metrics.groups).toBe(2);
    expect(metrics.groupSize).toBe(5);
    expect(metrics.iterations).toBe(100);
    expect(metrics.success).toBe(true);
  });

  it('tracks memory usage when available', () => {
    const startData = monitor.startMonitoring('test-algorithm', 10, 2, 5);
    
    // Simulate memory allocation
    const testArray = new Array(1000).fill(0);
    
    const metrics = monitor.stopMonitoring(
      startData,
      'test-algorithm',
      10,
      2,
      5,
      50,
      true
    );

    // Memory usage may or may not be available depending on environment
    if (metrics.memoryUsageMB !== undefined) {
      expect(metrics.memoryUsageMB).toBeGreaterThanOrEqual(0);
    }
  });

  it('maintains performance history', () => {
    const startData1 = monitor.startMonitoring('algo1', 10, 2, 5);
    monitor.stopMonitoring(startData1, 'algo1', 10, 2, 5, 100, true);
    
    const startData2 = monitor.startMonitoring('algo1', 15, 3, 5);
    monitor.stopMonitoring(startData2, 'algo1', 15, 3, 5, 150, true);

    const history = monitor.getAlgorithmHistory('algo1');
    expect(history.totalRuns).toBe(2);
    expect(history.metrics).toHaveLength(2);
    expect(history.successRate).toBe(1.0);
  });

  it('calculates overall statistics correctly', () => {
    const startData1 = monitor.startMonitoring('algo1', 10, 2, 5);
    monitor.stopMonitoring(startData1, 'algo1', 10, 2, 5, 100, true);
    
    const startData2 = monitor.startMonitoring('algo2', 15, 3, 5);
    monitor.stopMonitoring(startData2, 'algo2', 15, 3, 5, 200, false, 'Test error');

    const stats = monitor.getOverallStats();
    expect(stats.totalRuns).toBe(2);
    expect(stats.successRate).toBe(0.5);
    expect(stats.metrics).toHaveLength(2);
  });

  it('checks performance thresholds', () => {
    const startData = monitor.startMonitoring('test-algorithm', 10, 2, 5);
    
    // Simulate slow execution
    const startTime = performance.now();
    while (performance.now() - startTime < 50) {
      // Busy wait for ~50ms
    }
    
    const metrics = monitor.stopMonitoring(
      startData,
      'test-algorithm',
      10,
      2,
      5,
      200000, // Higher than default threshold of 100000
      true
    );

    const thresholdCheck = monitor.checkThresholds(metrics);
    
    // Should exceed iteration threshold (default is 100000)
    expect(thresholdCheck.exceeded).toBe(true);
    expect(thresholdCheck.violations.length).toBeGreaterThan(0);
    expect(thresholdCheck.violations.some(v => v.includes('Iterations 200000 exceeds limit 100000'))).toBe(true);
  });

  it('allows threshold customization', () => {
    const customThresholds = {
      maxExecutionTimeMs: 100,
      maxIterations: 50,
      maxMemoryUsageMB: 10,
      minSuccessRate: 0.9,
    };

    monitor.setThresholds(customThresholds);
    const currentThresholds = monitor.getThresholds();

    expect(currentThresholds.maxExecutionTimeMs).toBe(100);
    expect(currentThresholds.maxIterations).toBe(50);
    expect(currentThresholds.maxMemoryUsageMB).toBe(10);
    expect(currentThresholds.minSuccessRate).toBe(0.9);
  });

  it('provides algorithm recommendations', () => {
    // Add some performance history
    const startData1 = monitor.startMonitoring('roundrobin', 10, 2, 5);
    monitor.stopMonitoring(startData1, 'roundrobin', 10, 2, 5, 10, true);
    
    const startData2 = monitor.startMonitoring('lpt', 10, 2, 5);
    monitor.stopMonitoring(startData2, 'lpt', 10, 2, 5, 50, true);

    const recommendations = monitor.getRecommendations(10, 2, 5);
    
    expect(recommendations.recommendedAlgorithm).toBeDefined();
    expect(recommendations.confidence).toBeGreaterThan(0);
    expect(recommendations.reasoning).toHaveLength(2);
  });

  it('handles empty history gracefully', () => {
    const history = monitor.getAlgorithmHistory('nonexistent');
    expect(history.totalRuns).toBe(0);
    expect(history.averageExecutionTime).toBe(0);
    expect(history.averageIterations).toBe(0);
    expect(history.successRate).toBe(0);

    const stats = monitor.getOverallStats();
    expect(stats.totalRuns).toBe(0);

    const recommendations = monitor.getRecommendations(10, 2, 5);
    expect(recommendations.recommendedAlgorithm).toBe('auto');
    expect(recommendations.confidence).toBe(0);
  });

  it('exports and imports data correctly', () => {
    const startData = monitor.startMonitoring('test-algorithm', 10, 2, 5);
    monitor.stopMonitoring(startData, 'test-algorithm', 10, 2, 5, 100, true);

    const exportedData = monitor.exportData();
    expect(exportedData).toContain('test-algorithm');
    expect(exportedData).toContain('"totalRuns": 1');

    // Clear and import
    monitor.clearHistory();
    expect(monitor.getOverallStats().totalRuns).toBe(0);

    monitor.importData(exportedData);
    expect(monitor.getOverallStats().totalRuns).toBe(1);
  });

  it('clears performance history', () => {
    const startData = monitor.startMonitoring('test-algorithm', 10, 2, 5);
    monitor.stopMonitoring(startData, 'test-algorithm', 10, 2, 5, 100, true);

    expect(monitor.getOverallStats().totalRuns).toBe(1);

    monitor.clearHistory();
    expect(monitor.getOverallStats().totalRuns).toBe(0);
  });
});

describe('monitorPerformance decorator', () => {
  let originalMonitor: PerformanceMonitor;

  beforeEach(() => {
    // Store original global monitor
    originalMonitor = globalPerformanceMonitor;
    // Replace with a fresh instance for testing
    (globalThis as any).globalPerformanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    // Clear the test monitor and restore original global monitor
    globalPerformanceMonitor.clearHistory();
    (globalThis as any).globalPerformanceMonitor = originalMonitor;
  });

  it('decorates synchronous functions', () => {
    const testFunction = (items: number[], groups: number, groupSize: number) => {
      return items.length * groups * groupSize;
    };

    const decoratedFunction = monitorPerformance('decorated-test', testFunction);
    const result = decoratedFunction([1, 2, 3], 2, 2);

    expect(result).toBe(12);
    
    const stats = globalPerformanceMonitor.getOverallStats();
    expect(stats.totalRuns).toBe(1);
    expect(stats.metrics[0]!.algorithm).toBe('decorated-test');
  });

  it('handles function errors gracefully', () => {
    const errorFunction = (items: number[]) => {
      throw new Error('Test error');
    };

    const decoratedFunction = monitorPerformance('error-test', errorFunction);
    
    expect(() => decoratedFunction([1, 2, 3])).toThrow('Test error');
    
    const stats = globalPerformanceMonitor.getOverallStats();
    expect(stats.totalRuns).toBe(1);
    expect(stats.metrics[0]!.success).toBe(false);
    expect(stats.metrics[0]!.errorMessage).toBe('Test error');
  });
});
