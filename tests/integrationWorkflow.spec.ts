import { describe, it, expect } from 'vitest';
import { partitionBalanced, fromCapacities, evaluateGrouping } from '../src/index.js';
import { generateJSONReport, generateCSVReport, generateMarkdownReport } from '../src/performanceReporting.js';

describe('Integration Workflow - end-to-end', () => {
  it('runs full workflow: generate -> partition -> evaluate -> report', () => {
    const items = fromCapacities([12.3, 5.1, 7.7, 9.2, 3.4, 11.0]);

    const result = partitionBalanced(items, 2, 3, {
      method: 'auto',
      timeLimitMs: 500,
      seed: 123,
      algorithmConfig: { evaluation: { useGpu: true, minSizeForGpu: 1 } } as any,
    });

    // Validate grouping integrity
    expect(result.groupsById).toHaveLength(2);
    expect(result.groupsById[0]).toHaveLength(3);
    expect(result.groupsById[1]).toHaveLength(3);

    // Evaluate consistency
    const evalRes = evaluateGrouping(items as any, result.groupsByIndex);
    expect(evalRes.groupSums).toHaveLength(2);
    expect(evalRes.delta).toBeGreaterThanOrEqual(0);

    // Generate performance reports
    const json = generateJSONReport({ recommendationProblem: { problemSize: 6, groups: 2, groupSize: 3 } });
    const parsed = JSON.parse(json);
    expect(parsed.monitor).toBeDefined();
    expect(parsed.history).toBeDefined();

    const csv = generateCSVReport();
    expect(csv.split('\n')[0]).toContain('section,algorithm');

    const md = generateMarkdownReport();
    expect(md).toContain('## Performance Report');
  });
});
