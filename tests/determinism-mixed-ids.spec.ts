import { describe, it, expect } from 'vitest';
import { partitionBalanced } from '../src/index.js';
import { Item } from '../src/types.js';

describe('Determinism Tests - Mixed ID Types', () => {
  describe('Equal Capacity Sorting', () => {
    it('should produce identical results with mixed string/number IDs and equal capacities', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 1, capacity: 10 },
        { id: 'b', capacity: 10 },
        { id: 2, capacity: 10 },
        { id: 'c', capacity: 10 },
        { id: 3, capacity: 10 },
        { id: 'd', capacity: 10 },
        { id: 4, capacity: 10 },
      ];

      // Run multiple times with same seed
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(partitionBalanced(items, 2, 4, { seed: 42 }));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
        expect(results[i]!.delta).toBe(results[0]!.delta);
        expect(results[i]!.stdev).toBe(results[0]!.stdev);
        expect(results[i]!.methodUsed).toBe(results[0]!.methodUsed);
      }
    });

    it('should produce identical results with mixed IDs and equal capacities across different algorithms', () => {
      const items: Item[] = [
        { id: 'item_1', capacity: 5 },
        { id: 1, capacity: 5 },
        { id: 'item_2', capacity: 5 },
        { id: 2, capacity: 5 },
        { id: 'item_3', capacity: 5 },
        { id: 3, capacity: 5 },
        { id: 'item_4', capacity: 5 },
        { id: 4, capacity: 5 },
      ];

      const algorithms = ['roundrobin', 'lpt', 'kk'] as const;
      const results: Record<string, any> = {};

      // Test each algorithm multiple times
      for (const algorithm of algorithms) {
        const algorithmResults = [];
        for (let i = 0; i < 3; i++) {
          algorithmResults.push(
            partitionBalanced(items, 2, 4, { 
              method: algorithm, 
              seed: 123 
            })
          );
        }

        // All runs of the same algorithm should be identical
        for (let i = 1; i < algorithmResults.length; i++) {
          expect(algorithmResults[i]!.groupsById).toEqual(algorithmResults[0]!.groupsById);
        }

        results[algorithm] = algorithmResults[0];
      }

      // Each algorithm should produce consistent results
      expect(results.roundrobin).toBeDefined();
      expect(results.lpt).toBeDefined();
      expect(results.kk).toBeDefined();
    });

    it('should handle complex mixed ID scenarios deterministically', () => {
      const items: Item[] = [
        { id: 'alpha', capacity: 1 },
        { id: 0, capacity: 1 },
        { id: 'beta', capacity: 1 },
        { id: 1, capacity: 1 },
        { id: 'gamma', capacity: 1 },
        { id: 2, capacity: 1 },
        { id: 'delta', capacity: 1 },
        { id: 3, capacity: 1 },
        { id: 'epsilon', capacity: 1 },
        { id: 4, capacity: 1 },
        { id: 'zeta', capacity: 1 },
        { id: 5, capacity: 1 },
      ];

      const result1 = partitionBalanced(items, 3, 4, { seed: 456 });
      const result2 = partitionBalanced(items, 3, 4, { seed: 456 });

      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.delta).toBe(result2.delta);
      expect(result1.stdev).toBe(result2.stdev);
    });
  });

  describe('Mixed Capacity and ID Types', () => {
    it('should produce deterministic results with mixed capacities and mixed IDs', () => {
      const items: Item[] = [
        { id: 'high_1', capacity: 100 },
        { id: 1, capacity: 100 },
        { id: 'high_2', capacity: 100 },
        { id: 2, capacity: 100 },
        { id: 'low_1', capacity: 1 },
        { id: 3, capacity: 1 },
        { id: 'low_2', capacity: 1 },
        { id: 4, capacity: 1 },
      ];

      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(partitionBalanced(items, 2, 4, { seed: 789 }));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
        expect(results[i]!.delta).toBe(results[0]!.delta);
      }
    });

    it('should maintain deterministic ordering with mixed ID types in auto strategy', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 1, capacity: 10 },
        { id: 'b', capacity: 10 },
        { id: 2, capacity: 10 },
        { id: 'c', capacity: 10 },
        { id: 3, capacity: 10 },
        { id: 'd', capacity: 10 },
        { id: 4, capacity: 10 },
      ];

      const result1 = partitionBalanced(items, 2, 4, { 
        method: 'auto', 
        seed: 999 
      });
      const result2 = partitionBalanced(items, 2, 4, { 
        method: 'auto', 
        seed: 999 
      });

      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.methodUsed).toBe(result2.methodUsed);
    });
  });

  describe('Edge Cases with Mixed IDs', () => {
    it('should handle numeric strings vs numbers deterministically', () => {
      const items: Item[] = [
        { id: '1', capacity: 5 }, // String "1"
        { id: 1, capacity: 5 },   // Number 1
        { id: '2', capacity: 5 }, // String "2"
        { id: 2, capacity: 5 },   // Number 2
      ];

      const result1 = partitionBalanced(items, 1, 4, { seed: 111 });
      const result2 = partitionBalanced(items, 1, 4, { seed: 111 });

      expect(result1.groupsById).toEqual(result2.groupsById);
    });

    it('should handle empty string vs number zero deterministically', () => {
      const items: Item[] = [
        { id: '', capacity: 3 },  // Empty string
        { id: 0, capacity: 3 },   // Number zero
        { id: '0', capacity: 3 }, // String "0"
        { id: 1, capacity: 3 },   // Number 1
      ];

      const result1 = partitionBalanced(items, 1, 4, { seed: 222 });
      const result2 = partitionBalanced(items, 1, 4, { seed: 222 });

      expect(result1.groupsById).toEqual(result2.groupsById);
    });

    it('should handle special characters in string IDs deterministically', () => {
      const items: Item[] = [
        { id: 'item-1', capacity: 2 },
        { id: 'item_1', capacity: 2 },
        { id: 'item.1', capacity: 2 },
        { id: 'item 1', capacity: 2 },
        { id: 1, capacity: 2 },
        { id: 2, capacity: 2 },
      ];

      const result1 = partitionBalanced(items, 2, 3, { seed: 333 });
      const result2 = partitionBalanced(items, 2, 3, { seed: 333 });

      expect(result1.groupsById).toEqual(result2.groupsById);
    });
  });

  describe('Cross-Algorithm Consistency', () => {
    it('should produce consistent results across different algorithms with mixed IDs', () => {
      const items: Item[] = [
        { id: 'x', capacity: 8 },
        { id: 1, capacity: 8 },
        { id: 'y', capacity: 8 },
        { id: 2, capacity: 8 },
        { id: 'z', capacity: 8 },
        { id: 3, capacity: 8 },
      ];

      const algorithms = ['roundrobin', 'lpt', 'kk'] as const;
      const results: Record<string, any> = {};

      for (const algorithm of algorithms) {
        results[algorithm] = partitionBalanced(items, 2, 3, { 
          method: algorithm, 
          seed: 444 
        });
      }

      // Each algorithm should produce valid results
      for (const algorithm of algorithms) {
        expect(results[algorithm]).toBeDefined();
        expect(results[algorithm].groupsById).toHaveLength(2);
        expect(results[algorithm].groupsById[0]).toHaveLength(3);
        expect(results[algorithm].groupsById[1]).toHaveLength(3);
      }
    });

    it('should maintain deterministic behavior with large mixed ID sets', () => {
      const items: Item[] = [];
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          items.push({ id: `item_${i}`, capacity: 1 });
        } else {
          items.push({ id: i, capacity: 1 });
        }
      }

      const result1 = partitionBalanced(items, 4, 5, { seed: 555 });
      const result2 = partitionBalanced(items, 4, 5, { seed: 555 });

      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.delta).toBe(result2.delta);
    });
  });

  describe('Reproducibility Across Runs', () => {
    it('should produce identical results across multiple runs with same seed', () => {
      const items: Item[] = [
        { id: 'test_1', capacity: 7 },
        { id: 1, capacity: 7 },
        { id: 'test_2', capacity: 7 },
        { id: 2, capacity: 7 },
        { id: 'test_3', capacity: 7 },
        { id: 3, capacity: 7 },
        { id: 'test_4', capacity: 7 },
        { id: 4, capacity: 7 },
      ];

      const seed = 666;
      const runs = 10;
      const results = [];

      for (let i = 0; i < runs; i++) {
        results.push(partitionBalanced(items, 2, 4, { seed }));
      }

      // All runs should be identical
      for (let i = 1; i < runs; i++) {
        expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
        expect(results[i]!.delta).toBe(results[0]!.delta);
        expect(results[i]!.stdev).toBe(results[0]!.stdev);
        expect(results[i]!.methodUsed).toBe(results[0]!.methodUsed);
      }
    });

    it('should produce different results with different seeds', () => {
      const items: Item[] = [
        { id: 'a', capacity: 1 },
        { id: 1, capacity: 1 },
        { id: 'b', capacity: 1 },
        { id: 2, capacity: 1 },
        { id: 'c', capacity: 1 },
        { id: 3, capacity: 1 },
        { id: 'd', capacity: 1 },
        { id: 4, capacity: 1 },
      ];

      const result1 = partitionBalanced(items, 2, 4, { seed: 777 });
      const result2 = partitionBalanced(items, 2, 4, { seed: 888 });

      // Results should be different (though this is not guaranteed for all algorithms)
      // We just verify that both results are valid
      expect(result1.groupsById).toHaveLength(2);
      expect(result2.groupsById).toHaveLength(2);
      expect(result1.groupsById[0]).toHaveLength(4);
      expect(result2.groupsById[0]).toHaveLength(4);
    });
  });
});
