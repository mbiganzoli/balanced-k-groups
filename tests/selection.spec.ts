import { describe, it, expect } from 'vitest';
import { partitionBalanced, fromCapacities } from '../src/index.js';

describe('Dynamic Algorithm Selection (auto)', () => {
  it('respects preferred and disallowed algorithms', () => {
    const items = fromCapacities([10, 9, 8, 7, 6, 5]); // 6 items
    const result = partitionBalanced(items, 2, 3, {
      method: 'auto',
      preferredAlgorithms: ['kk'],
      disallowedAlgorithms: ['lpt', 'roundrobin'],
      timeLimitMs: 500,
    });

    expect(result.groupsById).toHaveLength(2);
    expect(result.delta).toBeGreaterThanOrEqual(0);
    // Should not be a disallowed method
    expect(result.methodUsed.includes('lpt')).toBe(false);
    expect(result.methodUsed.includes('roundrobin')).toBe(false);
  });

  it('applies speed vs quality strategy influence', () => {
    const items = fromCapacities([12, 11, 10, 9, 8, 7, 6, 5]); // 8 items

    const fast = partitionBalanced(items, 2, 4, {
      method: 'auto',
      selectionStrategy: 'speed',
      timeLimitMs: 500,
    });
    const quality = partitionBalanced(items, 2, 4, {
      method: 'auto',
      selectionStrategy: 'quality',
      timeLimitMs: 500,
    });

    // Both results valid
    expect(fast.groupsById).toHaveLength(2);
    expect(quality.groupsById).toHaveLength(2);
    // Method names should be among expected pools (non-strict)
    const fastPool = ['roundrobin', 'lpt', 'kk'];
    const qualityPool = ['kk', 'lpt', 'dp'];
    expect(fastPool.some(p => fast.methodUsed.includes(p))).toBe(true);
    expect(qualityPool.some(p => quality.methodUsed.includes(p))).toBe(true);
  });

  it('hybrid refinement does not worsen and can improve delta', () => {
    const items = fromCapacities([20, 19, 18, 4, 3, 2]); // deliberately skewed
    const base = partitionBalanced(items, 2, 3, {
      method: 'auto',
      timeLimitMs: 300,
    });
    const hybrid = partitionBalanced(items, 2, 3, {
      method: 'auto',
      hybrid: { enable: true, refineIters: 20 },
      timeLimitMs: 300,
    });

    expect(hybrid.delta).toBeLessThanOrEqual(base.delta);
  });

  it('falls back gracefully when all candidates are disallowed', () => {
    const items = fromCapacities([9, 8, 7, 6]);
    const result = partitionBalanced(items, 2, 2, {
      method: 'auto',
      disallowedAlgorithms: ['roundrobin', 'lpt', 'kk', 'dp', 'backtracking', 'flow', 'metaheuristic'],
      timeLimitMs: 100,
    });

    expect(result.groupsById).toHaveLength(2);
    expect(result.methodUsed.toLowerCase()).toContain('graceful-degradation');
  });
});
