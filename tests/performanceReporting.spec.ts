import { describe, it, expect, beforeEach } from 'vitest';
import { generateJSONReport, generateCSVReport, generateMarkdownReport } from '../src/performanceReporting.js';
import { globalPerformanceMonitor } from '../src/performance.js';
import { globalPerformanceHistoryTracker } from '../src/performanceHistory.js';
import { globalBenchmarkRunner } from '../src/benchmark.js';

describe('performance reporting (minimal)', () => {
  beforeEach(() => {
    globalPerformanceMonitor.clearHistory();
    globalPerformanceHistoryTracker.clearHistory();
    globalBenchmarkRunner.clearResults();
  });

  it('generates JSON report with core sections', () => {
    const start = globalPerformanceMonitor.startMonitoring('roundrobin', 10, 2, 5);
    const m1 = globalPerformanceMonitor.stopMonitoring(start, 'roundrobin', 10, 2, 5, 100, true);

    globalPerformanceHistoryTracker.addEntry({
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      algorithm: 'roundrobin',
      executionTimeMs: m1.executionTimeMs,
      iterations: 100,
      delta: 4.5,
      stdev: 2.1,
      success: true,
    });

    const benchJson = JSON.stringify({
      results: [
        {
          algorithm: 'roundrobin',
          problemSize: 10,
          groups: 2,
          groupSize: 5,
          executionTimeMs: 12.34,
          iterations: 0,
          delta: 4.5,
          stdev: 2.0,
          success: true,
        },
      ],
      timestamp: new Date().toISOString(),
    });
    globalBenchmarkRunner.importResults(benchJson);

    const json = generateJSONReport({ recommendationProblem: { problemSize: 10, groups: 2, groupSize: 5 } });
    const parsed = JSON.parse(json);

    expect(parsed.monitor).toBeDefined();
    expect(parsed.history).toBeDefined();
    expect(parsed.benchmarks).toBeDefined();
  });

  it('generates CSV report including headers', () => {
    const start = globalPerformanceMonitor.startMonitoring('lpt', 20, 4, 5);
    globalPerformanceMonitor.stopMonitoring(start, 'lpt', 20, 4, 5, 50, true);

    const csv = generateCSVReport();
    expect(csv).toContain('section,algorithm');
  });

  it('generates Markdown report with headings', () => {
    const md = generateMarkdownReport();
    expect(md).toContain('## Performance Report');
  });
});
