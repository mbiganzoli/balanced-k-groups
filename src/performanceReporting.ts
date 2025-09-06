import { globalPerformanceMonitor, PerformanceHistory, PerformanceMetrics } from './performance.js';
import { globalPerformanceHistoryTracker } from './performanceHistory.js';
import { globalBenchmarkRunner, BenchmarkResult } from './benchmark.js';

export interface ReportOptions {
  algorithms?: string[];
  timeframeMs?: number; // Only include entries within the last timeframeMs
  include?: {
    metrics?: boolean;
    history?: boolean;
    benchmark?: boolean;
    trends?: boolean;
    analysis?: boolean;
    recommendations?: boolean;
  };
  recommendationProblem?: { problemSize: number; groups: number; groupSize: number };
}

function filterByOptions<T extends { timestamp?: number; algorithm?: string }>(
  items: T[],
  options?: ReportOptions
): T[] {
  let result = items;

  if (options?.algorithms && options.algorithms.length > 0) {
    const set = new Set(options.algorithms);
    result = result.filter(i => (i as any).algorithm ? set.has((i as any).algorithm) : true);
  }

  if (options?.timeframeMs) {
    const cutoff = Date.now() - options.timeframeMs;
    result = result.filter(i => (i as any).timestamp ? (i as any).timestamp! >= cutoff : true);
  }

  return result;
}

function collectMonitorData(options?: ReportOptions) {
  const overall: PerformanceHistory = globalPerformanceMonitor.getOverallStats();
  const metrics = filterByOptions(overall.metrics, options);

  // Unique algorithms from metrics
  const algorithms = Array.from(new Set(metrics.map(m => m.algorithm)));
  const perAlgorithm = algorithms.map(algo => ({
    algorithm: algo,
    history: globalPerformanceMonitor.getAlgorithmHistory(algo),
  }));

  return { overall: { ...overall, metrics }, perAlgorithm };
}

function collectHistoryData(options?: ReportOptions) {
  // Export and parse to get raw entries
  const exported = globalPerformanceHistoryTracker.exportHistory();
  let historyEntries: any[] = [];
  try {
    const parsed = JSON.parse(exported);
    if (Array.isArray(parsed.history)) {
      historyEntries = parsed.history;
    }
  } catch {
    // ignore
  }

  const filtered = filterByOptions(historyEntries as any[], options);
  const perfMap = globalPerformanceHistoryTracker.getAllAlgorithmPerformance();
  const algorithms = Array.from(perfMap.keys());
  const stats = algorithms.map(a => ({ algorithm: a, ...(perfMap.get(a) as any) }));

  return { entries: filtered, stats };
}

function collectBenchmarkData(options?: ReportOptions) {
  const results = filterByOptions(globalBenchmarkRunner.getResults() as any[], options) as BenchmarkResult[];

  // Summaries
  let fastest = 'none';
  let fastestTime = Infinity;
  let mostBalanced = 'none';
  let bestDelta = Infinity;

  const byAlgorithm = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    if (!byAlgorithm.has(r.algorithm)) byAlgorithm.set(r.algorithm, []);
    byAlgorithm.get(r.algorithm)!.push(r);
  }

  for (const [algo, arr] of byAlgorithm) {
    const successful = arr.filter(r => r.success);
    const avgTime = successful.reduce((s, r) => s + r.executionTimeMs, 0) / Math.max(successful.length, 1);
    const avgDelta = successful.reduce((s, r) => s + r.delta, 0) / Math.max(successful.length, 1);
    if (avgTime < fastestTime) {
      fastestTime = avgTime;
      fastest = algo;
    }
    if (avgDelta < bestDelta) {
      bestDelta = avgDelta;
      mostBalanced = algo;
    }
  }

  return {
    results,
    summary: {
      totalRuns: results.length,
      fastestAlgorithm: fastest,
      averageFastestTimeMs: isFinite(fastestTime) ? fastestTime : 0,
      mostBalancedAlgorithm: mostBalanced,
      averageBestDelta: isFinite(bestDelta) ? bestDelta : 0,
    },
  };
}

export function generateJSONReport(options: ReportOptions = {}): string {
  const include = { metrics: true, history: true, benchmark: true, trends: true, analysis: true, recommendations: true, ...(options.include || {}) };

  const monitorData = include.metrics ? collectMonitorData(options) : undefined;
  const historyData = include.history ? collectHistoryData(options) : undefined;
  const benchmarkData = include.benchmark ? collectBenchmarkData(options) : undefined;

  const trends = include.trends && historyData
    ? (historyData.stats || []).map((s: any) => ({
        algorithm: s.algorithm,
        ...globalPerformanceHistoryTracker.getPerformanceTrends(s.algorithm, 24),
      }))
    : undefined;

  const analysis = include.analysis && historyData
    ? {
        topBySuccessRate: [...(historyData.stats || [])]
          .sort((a: any, b: any) => b.successRate - a.successRate)
          .slice(0, 3)
          .map((x: any) => ({ algorithm: x.algorithm, successRate: x.successRate })),
        topBySpeed: (monitorData?.perAlgorithm || [])
          .map((p) => ({ algorithm: p.algorithm, avgTime: p.history.averageExecutionTime }))
          .sort((a, b) => a.avgTime - b.avgTime)
          .slice(0, 3),
      }
    : undefined;

  const recProblem = options.recommendationProblem || (() => {
    const m = monitorData?.overall.metrics?.[monitorData.overall.metrics.length - 1];
    if (m) return { problemSize: m.problemSize, groups: m.groups, groupSize: m.groupSize };
    const h = (historyData?.entries || []).slice(-1)[0];
    if (h) return { problemSize: h.problemSize, groups: h.groups, groupSize: h.groupSize };
    const b = (benchmarkData?.results || []).slice(-1)[0];
    if (b) return { problemSize: b.problemSize, groups: b.groups, groupSize: b.groupSize };
    return { problemSize: 0, groups: 0, groupSize: 0 };
  })();

  const recommendations = include.recommendations
    ? {
        fromPerformance: globalPerformanceMonitor.getRecommendations(
          recProblem.problemSize,
          recProblem.groups,
          recProblem.groupSize
        ),
        fromBenchmarks: globalBenchmarkRunner.getRecommendations(
          recProblem.problemSize,
          recProblem.groups,
          recProblem.groupSize
        ),
      }
    : undefined;

  const report = {
    generatedAt: new Date().toISOString(),
    filters: { algorithms: options.algorithms, timeframeMs: options.timeframeMs },
    monitor: monitorData,
    history: historyData,
    benchmarks: benchmarkData,
    trends,
    analysis,
    recommendations,
  } as const;

  return JSON.stringify(report, null, 2);
}

export function generateCSVReport(options: ReportOptions = {}): string {
  const lines: string[] = [];

  // Metrics from performance monitor
  const monitorData = collectMonitorData(options);
  lines.push('section,algorithm,problemSize,groups,groupSize,executionTimeMs,iterations,success,timestamp');
  for (const m of monitorData.overall.metrics) {
    lines.push([
      'monitor',
      m.algorithm,
      m.problemSize,
      m.groups,
      m.groupSize,
      m.executionTimeMs.toFixed(2),
      m.iterations,
      m.success,
      m.timestamp,
    ].join(','));
  }

  // History entries
  const history = collectHistoryData(options);
  lines.push('section,algorithm,problemSize,groups,groupSize,executionTimeMs,iterations,delta,stdev,success,timestamp');
  for (const e of history.entries as any[]) {
    lines.push([
      'history',
      e.algorithm,
      e.problemSize,
      e.groups,
      e.groupSize,
      (e.executionTimeMs ?? '').toString(),
      (e.iterations ?? '').toString(),
      (e.delta ?? '').toString(),
      (e.stdev ?? '').toString(),
      e.success,
      e.timestamp,
    ].join(','));
  }

  // Benchmark results
  const bench = collectBenchmarkData(options);
  lines.push('section,algorithm,problemSize,groups,groupSize,executionTimeMs,iterations,delta,stdev,success');
  for (const r of bench.results) {
    lines.push([
      'benchmark',
      r.algorithm,
      r.problemSize,
      r.groups,
      r.groupSize,
      r.executionTimeMs.toFixed(2),
      r.iterations,
      r.delta,
      r.stdev,
      r.success,
    ].join(','));
  }

  return lines.join('\n');
}

export function generateMarkdownReport(options: ReportOptions = {}): string {
  const monitor = collectMonitorData(options);
  const history = collectHistoryData(options);
  const bench = collectBenchmarkData(options);

  let md = '';
  md += `## Performance Report\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += `### Monitor Overview\n`;
  md += `- Total runs: ${monitor.overall.totalRuns}\n`;
  md += `- Success rate: ${(monitor.overall.successRate * 100).toFixed(1)}%\n`;
  md += `- Avg time: ${monitor.overall.averageExecutionTime.toFixed(2)}ms\n\n`;

  if (monitor.perAlgorithm.length > 0) {
    md += `#### By Algorithm\n`;
    md += `algorithm | runs | successRate | avgTimeMs | avgIterations\n`;
    md += `--- | ---:| ---:| ---:| ---:\n`;
    for (const p of monitor.perAlgorithm) {
      md += `${p.algorithm} | ${p.history.totalRuns} | ${(p.history.successRate * 100).toFixed(1)}% | ${p.history.averageExecutionTime.toFixed(2)} | ${p.history.averageIterations.toFixed(2)}\n`;
    }
    md += `\n`;
  }

  md += `### History Analysis\n`;
  if (history.stats.length === 0) {
    md += `No history data.\n\n`;
  } else {
    md += `algorithm | successRate | avgTime | avgDelta\n`;
    md += `--- | ---:| ---:| ---:\n`;
    for (const s of history.stats as any[]) {
      md += `${s.algorithm} | ${(s.successRate * 100).toFixed(1)}% | ${s.averageExecutionTime?.toFixed?.(2) ?? 'n/a'} | ${s.averageDelta?.toFixed?.(2) ?? 'n/a'}\n`;
    }
    md += `\n`;
  }

  md += `### Benchmark Summary\n`;
  md += `- Total runs: ${bench.summary.totalRuns}\n`;
  md += `- Fastest: ${bench.summary.fastestAlgorithm} (${bench.summary.averageFastestTimeMs.toFixed(2)}ms avg)\n`;
  md += `- Most balanced: ${bench.summary.mostBalancedAlgorithm} (avg delta ${bench.summary.averageBestDelta.toFixed(2)})\n\n`;

  return md;
}
