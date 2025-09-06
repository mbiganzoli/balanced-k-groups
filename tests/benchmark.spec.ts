import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkRunner, BenchmarkResult } from '../src/benchmark.js';
import { Item } from '../src/types.js';

describe('BenchmarkRunner', () => {
  let benchmarkRunner: BenchmarkRunner;

  beforeEach(() => {
    benchmarkRunner = new BenchmarkRunner();
  });

  it('generates synthetic test data correctly', () => {
    const items = benchmarkRunner.generateTestData(10, [1, 100], 42);
    
    expect(items).toHaveLength(10);
    for (const item of items) {
      expect(item.capacity).toBeGreaterThanOrEqual(1);
      expect(item.capacity).toBeLessThanOrEqual(100);
      expect(item.id).toMatch(/^item_\d+$/);
    }
  });

  it('generates reproducible test data with same seed', () => {
    const items1 = benchmarkRunner.generateTestData(5, [1, 50], 42);
    const items2 = benchmarkRunner.generateTestData(5, [1, 50], 42);
    
    expect(items1).toEqual(items2);
  });

  it('generates different test data with different seeds', () => {
    const items1 = benchmarkRunner.generateTestData(5, [1, 50], 42);
    const items2 = benchmarkRunner.generateTestData(5, [1, 50], 123);
    
    // Should be different (though occasionally might be the same due to randomness)
    const different = JSON.stringify(items1) !== JSON.stringify(items2);
    expect(different).toBe(true);
  });

  it('runs single benchmark successfully', async () => {
    const items: Item[] = [
      { id: 'a', capacity: 8 },
      { id: 'b', capacity: 7 },
      { id: 'c', capacity: 6 },
      { id: 'd', capacity: 5 },
    ];

    const result = await benchmarkRunner.runSingleBenchmark('roundrobin', items, 2, 2);
    
    expect(result.algorithm).toBe('roundrobin');
    expect(result.problemSize).toBe(4);
    expect(result.groups).toBe(2);
    expect(result.groupSize).toBe(2);
    expect(result.executionTimeMs).toBeGreaterThan(0);
    expect(result.success).toBe(true);
    expect(result.delta).toBeGreaterThanOrEqual(0);
    expect(result.stdev).toBeGreaterThanOrEqual(0);
  });

  it('handles benchmark failures gracefully', async () => {
    const items: Item[] = [
      { id: 'a', capacity: 8 },
      { id: 'b', capacity: 7 },
    ];

    // Try to use an invalid algorithm name
    const result = await benchmarkRunner.runSingleBenchmark('invalid-algorithm', items, 1, 2);
    
    expect(result.algorithm).toBe('invalid-algorithm');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.delta).toBe(Infinity);
    expect(result.stdev).toBe(Infinity);
  });

  it('runs comprehensive benchmark', async () => {
    const comparison = await benchmarkRunner.runComprehensiveBenchmark({
      algorithms: ['roundrobin', 'lpt'],
      problemSizes: [4, 8],
      groupCounts: [2],
      groupSizes: [2, 4],
      iterations: 2,
      timeLimitMs: 5000,
      seed: 42,
    });

    expect(comparison.results.length).toBeGreaterThan(0);
    expect(comparison.summary).toBeDefined();
    expect(comparison.summary.totalRuns).toBeGreaterThan(0);
    expect(comparison.summary.fastestAlgorithm).toBeDefined();
    expect(comparison.summary.mostBalancedAlgorithm).toBeDefined();
    expect(comparison.summary.mostEfficientAlgorithm).toBeDefined();
  });

  it('generates meaningful performance comparison', async () => {
    // Run a small benchmark
    await benchmarkRunner.runComprehensiveBenchmark({
      algorithms: ['roundrobin', 'lpt'],
      problemSizes: [4],
      groupCounts: [2],
      groupSizes: [2],
      iterations: 3,
      seed: 42,
    });

    const comparison = benchmarkRunner.generateComparison();
    
    expect(comparison.results.length).toBeGreaterThan(0);
    expect(comparison.summary.totalRuns).toBeGreaterThan(0);
    
    // Should have some successful runs
    const successfulRuns = comparison.results.filter(r => r.success);
    expect(successfulRuns.length).toBeGreaterThan(0);
  });

  it('provides performance recommendations', async () => {
    // Run some benchmarks first
    await benchmarkRunner.runComprehensiveBenchmark({
      algorithms: ['roundrobin', 'lpt'],
      problemSizes: [4, 8],
      groupCounts: [2],
      groupSizes: [2, 4],
      iterations: 2,
      seed: 42,
    });

    const recommendations = benchmarkRunner.getRecommendations(4, 2, 2);
    
    expect(recommendations.recommendedAlgorithm).toBeDefined();
    expect(recommendations.confidence).toBeGreaterThan(0);
    expect(recommendations.reasoning).toHaveLength(2); // roundrobin and lpt
  });

  it('handles empty results gracefully', () => {
    const comparison = benchmarkRunner.generateComparison();
    
    expect(comparison.results).toHaveLength(0);
    expect(comparison.summary.fastestAlgorithm).toBe('none');
    expect(comparison.summary.mostBalancedAlgorithm).toBe('none');
    expect(comparison.summary.mostEfficientAlgorithm).toBe('none');
    expect(comparison.summary.averageExecutionTime).toBe(0);
    expect(comparison.summary.averageDelta).toBe(0);
    expect(comparison.summary.totalRuns).toBe(0);
  });

  it('manages benchmark results correctly', async () => {
    const items: Item[] = [
      { id: 'a', capacity: 8 },
      { id: 'b', capacity: 7 },
      { id: 'c', capacity: 6 },
      { id: 'd', capacity: 5 },
    ];

    // Run some benchmarks
    await benchmarkRunner.runSingleBenchmark('roundrobin', items, 2, 2);
    await benchmarkRunner.runSingleBenchmark('lpt', items, 2, 2);

    expect(benchmarkRunner.getResults()).toHaveLength(2);

    // Clear results
    benchmarkRunner.clearResults();
    expect(benchmarkRunner.getResults()).toHaveLength(0);
  });

  it('exports and imports benchmark results', async () => {
    const items: Item[] = [
      { id: 'a', capacity: 8 },
      { id: 'b', capacity: 7 },
    ];

    // Run a benchmark
    await benchmarkRunner.runSingleBenchmark('roundrobin', items, 1, 2);

    // Export results
    const exportedData = benchmarkRunner.exportResults();
    expect(exportedData).toContain('roundrobin');
    expect(exportedData).toContain('"results"');

    // Clear and import
    benchmarkRunner.clearResults();
    expect(benchmarkRunner.getResults()).toHaveLength(0);

    benchmarkRunner.importResults(exportedData);
    expect(benchmarkRunner.getResults()).toHaveLength(1);
  });

  it('handles recommendations for unknown problem sizes', () => {
    const recommendations = benchmarkRunner.getRecommendations(1000, 100, 10);
    
    expect(recommendations.recommendedAlgorithm).toBe('auto');
    expect(recommendations.confidence).toBe(0);
    expect(recommendations.reasoning).toContain('No benchmark data available');
  });

  it('produces consistent benchmark results with same seed', async () => {
    const items = benchmarkRunner.generateTestData(6, [1, 50], 42);
    
    // Run same benchmark twice with same seed
    const result1 = await benchmarkRunner.runSingleBenchmark('roundrobin', items, 2, 3, { seed: 42 });
    const result2 = await benchmarkRunner.runSingleBenchmark('roundrobin', items, 2, 3, { seed: 42 });
    
    // Results should be very similar (allowing for small timing variations)
    expect(result1.algorithm).toBe(result2.algorithm);
    expect(result1.problemSize).toBe(result2.problemSize);
    expect(result1.groups).toBe(result2.groups);
    expect(result1.groupSize).toBe(result2.groupSize);
    expect(result1.success).toBe(result2.success);
    expect(result1.delta).toBe(result2.delta);
  });
});
