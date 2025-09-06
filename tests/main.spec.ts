import { describe, it, expect } from 'vitest';
import { partitionBalanced, fromCapacities, evaluateGrouping } from '../src/index.js';
import { Item } from '../src/types.js';

describe('Main Library Functions', () => {
  describe('partitionBalanced', () => {
    it('should partition items successfully with auto method', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
        { id: 'e', capacity: 2 },
        { id: 'f', capacity: 1 },
      ];

      const result = partitionBalanced(items, 2, 3);

      expect(result.groupsById).toHaveLength(2);
      expect(result.groupsByIndex).toHaveLength(2);
      expect(result.groupSums).toHaveLength(2);
      expect(result.delta).toBeGreaterThanOrEqual(0);
      expect(result.stdev).toBeGreaterThanOrEqual(0);
      expect(result.methodUsed).toBeDefined();
      
      // Each group should have exactly 3 items
      expect(result.groupsById[0]).toHaveLength(3);
      expect(result.groupsById[1]).toHaveLength(3);
    });

    it('should work with roundrobin method', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];

      const result = partitionBalanced(items, 2, 2, { method: 'roundrobin' });

      expect(result.methodUsed).toContain('roundrobin');
      expect(result.groupsById).toHaveLength(2);
    });

    it('should work with lpt method', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];

      const result = partitionBalanced(items, 2, 2, { method: 'lpt' });

      expect(result.methodUsed).toContain('lpt');
      expect(result.groupsById).toHaveLength(2);
    });

    it('should handle identical capacities', () => {
      const items: Item[] = [
        { id: '1', capacity: 5 },
        { id: '2', capacity: 5 },
        { id: '3', capacity: 5 },
        { id: '4', capacity: 5 },
      ];

      const result = partitionBalanced(items, 2, 2);

      expect(result.delta).toBe(0); // Perfect balance
      expect(result.stdev).toBe(0);
    });

    it('should respect time limits', () => {
      const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
        id: `item${i}`,
        capacity: Math.random() * 100 + 1,
      }));

      const startTime = performance.now();
      const result = partitionBalanced(items, 4, 5, { 
        method: 'auto',
        timeLimitMs: 100 
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should not exceed reasonable time
      expect(result.groupsById).toHaveLength(4);
    });
  });

  describe('fromCapacities', () => {
    it('should create items from capacity array', () => {
      const capacities = [10, 8, 6, 4, 2, 1];
      const items = fromCapacities(capacities);

      expect(items).toHaveLength(6);
      expect(items[0]).toEqual({ id: 'item0', capacity: 10 });
      expect(items[5]).toEqual({ id: 'item5', capacity: 1 });
    });

    it('should use custom ID prefix', () => {
      const capacities = [5, 3];
      const items = fromCapacities(capacities, 'test_');

      expect(items[0]!.id).toBe('test_0');
      expect(items[1]!.id).toBe('test_1');
    });

    it('should handle empty array', () => {
      const items = fromCapacities([]);
      expect(items).toEqual([]);
    });
  });

  describe('evaluateGrouping', () => {
    it('should evaluate grouping quality correctly', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];

      const groupsByIndex = [[0, 1], [2, 3]]; // Groups: [10,8] and [6,4]
      const evaluation = evaluateGrouping(items, groupsByIndex);

      expect(evaluation.groupSums).toEqual([18, 10]);
      expect(evaluation.delta).toBe(8);
      expect(evaluation.mean).toBe(14);
      expect(evaluation.totalCapacity).toBe(28);
    });

    it('should handle perfect balance', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 5 },
        { id: 'c', capacity: 5 },
        { id: 'd', capacity: 10 },
      ];

      const groupsByIndex = [[0, 1], [2, 3]]; // Groups: [10,5] and [5,10]
      const evaluation = evaluateGrouping(items, groupsByIndex);

      expect(evaluation.groupSums).toEqual([15, 15]);
      expect(evaluation.delta).toBe(0);
      expect(evaluation.stdev).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle the example from README', () => {
      const items = [
        { id: "a1", capacity: 12.3 },
        { id: "b7", capacity: 5.1 },
        { id: "c9", capacity: 7.7 },
        { id: "d4", capacity: 9.2 },
        { id: "e2", capacity: 3.4 },
        { id: "f5", capacity: 11.0 },
      ];

      const result = partitionBalanced(items, 2, 3, {
        method: "auto",
        timeLimitMs: 500,
        seed: 42,
        earlyStopDelta: 0.01,
      });

      expect(result.delta).toBeGreaterThanOrEqual(0);
      expect(result.groupSums).toHaveLength(2);
      expect(result.groupsById).toHaveLength(2);
      expect(result.groupsById[0]).toHaveLength(3);
      expect(result.groupsById[1]).toHaveLength(3);
      
      // Verify all items are assigned
      const allAssignedIds = result.groupsById.flat();
      expect(allAssignedIds).toHaveLength(6);
      expect(new Set(allAssignedIds).size).toBe(6);
    });

    it('should produce consistent metrics when GPU evaluation flags are enabled', () => {
      const items = fromCapacities([10, 8, 6, 4, 2, 1]);

      const base = partitionBalanced(items, 2, 3);
      const withGpuEval = partitionBalanced(items, 2, 3, {
        algorithmConfig: {
          evaluation: { useGpu: true, minSizeForGpu: 1 }
        }
      } as any);

      // Group assignments may differ by algorithm randomness; compare metrics shape and basic invariants
      expect(withGpuEval.groupsById).toHaveLength(2);
      expect(withGpuEval.groupSums).toHaveLength(2);
      expect(withGpuEval.delta).toBeGreaterThanOrEqual(0);
      expect(withGpuEval.stdev).toBeGreaterThanOrEqual(0);

      // Re-evaluating both with CPU should match their stored metrics
      const baseEval = evaluateGrouping(items, base.groupsByIndex);
      const gpuEval = evaluateGrouping(items, withGpuEval.groupsByIndex);

      expect(base.groupSums).toEqual(baseEval.groupSums);
      expect(base.delta).toBe(baseEval.delta);
      expect(withGpuEval.groupSums).toEqual(gpuEval.groupSums);
      expect(withGpuEval.delta).toBe(gpuEval.delta);
    });

    it('should be reproducible with same seed', () => {
      const items = fromCapacities([10, 8, 6, 4, 2, 1]);
      
      const result1 = partitionBalanced(items, 2, 3, { seed: 42 });
      const result2 = partitionBalanced(items, 2, 3, { seed: 42 });
      
      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.delta).toBe(result2.delta);
    });

    it('should handle large problems efficiently', () => {
      const items = fromCapacities(
        Array.from({ length: 100 }, () => Math.random() * 100 + 1)
      );

      const startTime = performance.now();
      const result = partitionBalanced(items, 10, 10, { 
        method: 'auto',
        timeLimitMs: 1000 
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.groupsById).toHaveLength(10);
      expect(result.groupsById.every(group => group.length === 10)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', () => {
      // These should be caught by validation
      expect(() => partitionBalanced([], 1, 1)).toThrow();
      expect(() => partitionBalanced([{ id: 'a', capacity: 10 }], 0, 1)).toThrow();
      expect(() => partitionBalanced([{ id: 'a', capacity: 10 }], 1, 0)).toThrow();
    });

    it('should handle mismatched item count', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
      ];

      // 3 items but need 2*2=4 items
      expect(() => partitionBalanced(items, 2, 2)).toThrow();
    });

    it('should handle duplicate IDs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'a', capacity: 8 }, // Duplicate ID
      ];

      expect(() => partitionBalanced(items, 1, 2)).toThrow();
    });
  });
});
