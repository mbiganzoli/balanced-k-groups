import { describe, it, expect } from 'vitest';
import { roundRobin } from '../src/algorithms/roundrobin.js';
import { Item } from '../src/types.js';

describe('Round-robin Determinism', () => {
  it('should produce identical results with mixed string/number IDs', () => {
    const items: Item[] = [
      { id: 'a', capacity: 10 },
      { id: 1, capacity: 10 },
      { id: 'b', capacity: 8 },
      { id: 2, capacity: 8 },
      { id: 'c', capacity: 6 },
      { id: 3, capacity: 6 },
    ];

    // Run multiple times to ensure deterministic behavior
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(roundRobin(items, 2, 3, { seed: 42 }));
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
      expect(results[i]!.groupsByIndex).toEqual(results[0]!.groupsByIndex);
      expect(results[i]!.delta).toBe(results[0]!.delta);
    }
  });

  it('should handle equal capacities with mixed ID types deterministically', () => {
    const items: Item[] = [
      { id: 'item1', capacity: 5 },
      { id: 1, capacity: 5 },
      { id: 'item2', capacity: 5 },
      { id: 2, capacity: 5 },
    ];

    const result1 = roundRobin(items, 2, 2, { seed: 123 });
    const result2 = roundRobin(items, 2, 2, { seed: 123 });

    expect(result1.groupsById).toEqual(result2.groupsById);
    expect(result1.groupsByIndex).toEqual(result2.groupsByIndex);
  });

  it('should maintain deterministic ordering across different seed values', () => {
    const items: Item[] = [
      { id: 'a', capacity: 10 },
      { id: 1, capacity: 10 },
      { id: 'b', capacity: 8 },
      { id: 2, capacity: 8 },
    ];

    const result1 = roundRobin(items, 2, 2, { seed: 100 });
    const result2 = roundRobin(items, 2, 2, { seed: 200 });

    // Results should be identical regardless of seed for round-robin
    // (round-robin doesn't use randomness, only deterministic sorting)
    expect(result1.groupsById).toEqual(result2.groupsById);
    expect(result1.groupsByIndex).toEqual(result2.groupsByIndex);
  });
});
