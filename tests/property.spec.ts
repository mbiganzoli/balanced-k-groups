import { describe, it, expect } from 'vitest';
import { partitionBalanced, fromCapacities } from '../src/index.js';

function randomCapacities(n: number): number[] {
  return Array.from({ length: n }, () => Math.random() * 100 + 1);
}

describe('Property-style invariants', () => {
  it('preserves item count and group sizes across random inputs', () => {
    for (let trial = 0; trial < 10; trial++) {
      const groups = 5;
      const groupSize = 4;
      const n = groups * groupSize;
      const items = fromCapacities(randomCapacities(n));

      const res = partitionBalanced(items, groups, groupSize, { method: 'auto', timeLimitMs: 500 });

      // Invariants
      expect(res.groupsById).toHaveLength(groups);
      for (let g = 0; g < groups; g++) {
        expect(res.groupsById[g]).toHaveLength(groupSize);
      }
      const allAssigned = res.groupsById.flat();
      expect(allAssigned).toHaveLength(n);
      expect(new Set(allAssigned).size).toBe(n);
      expect(res.delta).toBeGreaterThanOrEqual(0);
    }
  });
});
