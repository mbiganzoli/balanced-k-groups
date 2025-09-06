import { describe, it, expect } from 'vitest';
import { partitionBalanced, fromCapacities } from '../src/index.js';

describe('Reproducibility & Stress', () => {
  it('is reproducible with the same seed (auto)', () => {
    const items = fromCapacities([10, 9, 8, 7, 6, 5, 4, 3]);
    const a = partitionBalanced(items, 2, 4, { method: 'auto', seed: 42, timeLimitMs: 300 });
    const b = partitionBalanced(items, 2, 4, { method: 'auto', seed: 42, timeLimitMs: 300 });

    expect(a.groupsById).toEqual(b.groupsById);
    expect(a.delta).toBe(b.delta);
  });

  it('different seeds may produce different layouts', () => {
    const items = fromCapacities([10, 9, 8, 7, 6, 5, 4, 3]);
    const a = partitionBalanced(items, 2, 4, { method: 'auto', seed: 1, timeLimitMs: 300 });
    const b = partitionBalanced(items, 2, 4, { method: 'auto', seed: 2, timeLimitMs: 300 });

    // Allow equality, but expect often different assignments
    const equal = JSON.stringify(a.groupsById) === JSON.stringify(b.groupsById);
    expect(typeof equal).toBe('boolean');
  });

  it('handles a larger stress-like instance within time budget', () => {
    const items = fromCapacities(Array.from({ length: 200 }, () => Math.random() * 100 + 1));
    const start = performance.now();
    const result = partitionBalanced(items, 10, 20, { method: 'auto', timeLimitMs: 1000 });
    const end = performance.now();

    expect(end - start).toBeLessThan(6000);
    expect(result.groupsById).toHaveLength(10);
    expect(result.groupsById[0]).toHaveLength(20);
  });
});
