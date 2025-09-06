import { describe, it, expect } from 'vitest';
import { kk } from '../src/algorithms/kk.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('KK-inspired Algorithm', () => {
  const basicItems: Item[] = [
    { id: 'a', capacity: 10 },
    { id: 'b', capacity: 8 },
    { id: 'c', capacity: 6 },
    { id: 'd', capacity: 4 },
    { id: 'e', capacity: 2 },
    { id: 'f', capacity: 1 },
  ];

  it('produces valid grouping with exact sizes', () => {
    const result = kk(basicItems, 2, 3);
    expect(result.groupsById).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(3);
    expect(result.groupsByIndex[1]).toHaveLength(3);
    const evalRes = evaluateGrouping(basicItems, result.groupsByIndex);
    expect(evalRes.groupSums.reduce((a, b) => a + b, 0)).toBe(31);
    expect(result.methodUsed).toBe('kk');
  });

  it('handles larger inputs and keeps sizes exact', () => {
    const items: Item[] = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, capacity: i + 1 }));
    const res = kk(items, 10, 4);
    expect(res.groupsById).toHaveLength(10);
    res.groupsById.forEach(g => expect(g.length).toBe(4));
    expect(res.delta).toBeGreaterThanOrEqual(0);
  });

  it('keeps balance reasonable vs naive', () => {
    const res = kk(basicItems, 3, 2);
    const evalRes = evaluateGrouping(basicItems, res.groupsByIndex);
    expect(evalRes.delta).toBeLessThan(15);
  });

  it('local optimization should not worsen delta, typically improves it', () => {
    const items: Item[] = [
      { id: 'big1', capacity: 25 },
      { id: 'big2', capacity: 24 },
      { id: 'm1', capacity: 10 },
      { id: 'm2', capacity: 9 },
      { id: 's1', capacity: 3 },
      { id: 's2', capacity: 2 },
    ];
    const base = kk(items, 2, 3, { maxLocalIters: 0 });
    const opt = kk(items, 2, 3, { maxLocalIters: 300 });
    expect(opt.delta).toBeLessThanOrEqual(base.delta);
  });
});
