import { describe, it, expect } from 'vitest';
import { localRefine } from '../src/algorithms/localRefine.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('localRefine', () => {
  const items: Item[] = [
    { id: 'a', capacity: 15 },
    { id: 'b', capacity: 14 },
    { id: 'c', capacity: 10 },
    { id: 'd', capacity: 8 },
    { id: 'e', capacity: 4 },
    { id: 'f', capacity: 3 },
  ];

  it('best-improvement 1↔1/2↔2 reduces or maintains delta', () => {
    const groupsByIndex = [[0, 3, 5], [1, 2, 4]]; // two groups of 3
    const before = evaluateGrouping(items, groupsByIndex).delta;
    const res = localRefine(items, groupsByIndex.map(g => [...g]), {
      strategy: 'best',
      enable11: true,
      enable22: true,
      maxIters: 200,
    });
    const after = evaluateGrouping(items, res.groupsByIndex).delta;
    expect(after).toBeLessThanOrEqual(before);
    expect(res.groupsByIndex[0]).toHaveLength(3);
    expect(res.groupsByIndex[1]).toHaveLength(3);
  });

  it('stochastic 1↔1 works and preserves sizes', () => {
    const groupsByIndex = [[0, 2, 4], [1, 3, 5]];
    const before = evaluateGrouping(items, groupsByIndex).delta;
    const res = localRefine(items, groupsByIndex.map(g => [...g]), {
      strategy: 'stochastic',
      enable11: true,
      enable22: false,
      seed: 42,
      maxIters: 500,
    });
    const after = evaluateGrouping(items, res.groupsByIndex).delta;
    expect(after).toBeLessThanOrEqual(before);
    expect(res.groupsByIndex[0]).toHaveLength(3);
    expect(res.groupsByIndex[1]).toHaveLength(3);
  });
});

