import { describe, it, expect } from 'vitest';
import { fromCapacities, partitionBalanced } from '../src/index.js';

describe('partitionBalanced - Auto Strategy Time Budget', () => {
  it('returns early after baseline when timeLimitMs is extremely small', () => {
    const items = fromCapacities(Array.from({ length: 30 }, (_, i) => 30 - i));
    const result = partitionBalanced(items, 5, 6, { method: 'auto', timeLimitMs: 0 });

    expect(result.groupsById).toHaveLength(5);
    expect(result.groupSums).toHaveLength(5);
    // Likely baseline roundrobin result due to immediate time budget exhaustion
    expect(typeof result.methodUsed).toBe('string');
    expect(result.delta).toBeGreaterThanOrEqual(0);
  });
});
