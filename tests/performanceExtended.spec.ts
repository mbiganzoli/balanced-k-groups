import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, monitorPerformance, globalPerformanceMonitor, type PerformanceMetrics } from '../src/performance.js';

// Utility to create a metrics object for threshold checks without relying on environment memory support
function createMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
  return {
    executionTimeMs: 10,
    iterations: 100,
    algorithm: 'test',
    problemSize: 0,
    groups: 0,
    groupSize: 0,
    timestamp: Date.now(),
    success: true,
    ...overrides,
  } as PerformanceMetrics;
}

describe('PerformanceMonitor (extended)', () => {
  let monitor: PerformanceMonitor;
  let originalMonitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    // Keep a handle to the exported singleton for decorator tests
    originalMonitor = globalPerformanceMonitor;
    globalPerformanceMonitor.clearHistory();
  });

  afterEach(() => {
    // Ensure the global monitor is clean after each test
    globalPerformanceMonitor.clearHistory();
  });

  it('detects execution time threshold violations', () => {
    monitor.setThresholds({ maxExecutionTimeMs: 1 });

    const start = monitor.startMonitoring('algo', 1, 1, 1);
    // Minimal wait loop to exceed 1ms in most environments
    const t0 = performance.now();
    while (performance.now() - t0 < 2) {}
    const m = monitor.stopMonitoring(start, 'algo', 1, 1, 1, 1, true);

    const check = monitor.checkThresholds(m);
    expect(check.exceeded).toBe(true);
    expect(check.violations.some(v => v.includes('Execution time'))).toBe(true);
  });

  it('detects iteration threshold violations with custom limit', () => {
    monitor.setThresholds({ maxIterations: 10 });

    const start = monitor.startMonitoring('algo', 1, 1, 1);
    const m = monitor.stopMonitoring(start, 'algo', 1, 1, 1, 11, true);

    const check = monitor.checkThresholds(m);
    expect(check.exceeded).toBe(true);
    expect(check.violations.some(v => v.includes('Iterations'))).toBe(true);
  });

  it('detects memory usage threshold violations when memory info is present', () => {
    // Simulate memory usage by crafting a metrics object directly
    monitor.setThresholds({ maxMemoryUsageMB: 1 });
    const metrics = createMetrics({ memoryUsageMB: 2 });

    const check = monitor.checkThresholds(metrics);
    expect(check.exceeded).toBe(true);
    expect(check.violations.some(v => v.includes('Memory usage'))).toBe(true);
  });

  it('exports and imports thresholds along with metrics', () => {
    // Add one run and update thresholds
    const start = monitor.startMonitoring('algo', 2, 1, 2);
    monitor.stopMonitoring(start, 'algo', 2, 1, 2, 5, true);
    monitor.setThresholds({ maxExecutionTimeMs: 123, maxIterations: 456, maxMemoryUsageMB: 7, minSuccessRate: 0.42 });

    const exported = monitor.exportData();

    // Import into a fresh monitor and verify both metrics and thresholds
    const other = new PerformanceMonitor();
    other.importData(exported);

    const thresholds = other.getThresholds();
    expect(thresholds.maxExecutionTimeMs).toBe(123);
    expect(thresholds.maxIterations).toBe(456);
    expect(thresholds.maxMemoryUsageMB).toBe(7);
    expect(thresholds.minSuccessRate).toBeCloseTo(0.42);

    const overall = other.getOverallStats();
    expect(overall.totalRuns).toBe(1);
  });

  it('monitorPerformance decorates async functions (resolve)', async () => {
    const asyncFn = async (items: number[], groups: number, groupSize: number): Promise<number> => {
      // Simple immediate resolve; still ensures async branch
      return items.length * groups * groupSize;
    };

    const decorated = monitorPerformance('async-ok', asyncFn);
    const result = await decorated([1, 2, 3], 2, 2);

    expect(result).toBe(12);

    const stats = globalPerformanceMonitor.getOverallStats();
    expect(stats.totalRuns).toBe(1);
    expect(stats.metrics[0]!.algorithm).toBe('async-ok');
    expect(stats.metrics[0]!.success).toBe(true);
  });

  it('monitorPerformance decorates async functions (reject)', async () => {
    const asyncErr = async () => {
      throw new Error('Async failure');
    };

    const decorated = monitorPerformance('async-fail', asyncErr);

    await expect(decorated([] as any, 0 as any, 0 as any)).rejects.toThrow('Async failure');

    const stats = globalPerformanceMonitor.getOverallStats();
    expect(stats.totalRuns).toBe(1);
    expect(stats.metrics[0]!.algorithm).toBe('async-fail');
    expect(stats.metrics[0]!.success).toBe(false);
    expect(stats.metrics[0]!.errorMessage).toBe('Async failure');
  });
});
