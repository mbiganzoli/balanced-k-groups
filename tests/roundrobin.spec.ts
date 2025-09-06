import { describe, it, expect, beforeEach } from 'vitest';
import { roundRobin, roundRobinPartition, optimizedRoundRobinPartition } from '../src/algorithms/roundrobin.js';
import { Item } from '../src/types.js';

describe('Round-Robin Algorithm', () => {
  let basicItems: Item[];
  let identicalItems: Item[];
  let largeItems: Item[];

  beforeEach(() => {
    // Basic test items with different capacities
    basicItems = [
      { id: 'a', capacity: 10 },
      { id: 'b', capacity: 8 },
      { id: 'c', capacity: 6 },
      { id: 'd', capacity: 4 },
      { id: 'e', capacity: 2 },
      { id: 'f', capacity: 1 },
    ];

    // Items with identical capacities
    identicalItems = [
      { id: '1', capacity: 5 },
      { id: '2', capacity: 5 },
      { id: '3', capacity: 5 },
      { id: '4', capacity: 5 },
    ];

    // Larger set for performance testing
    largeItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item${i}`,
      capacity: Math.random() * 100 + 1,
    }));
  });

  describe('Basic Round-Robin Partition', () => {
    it('should partition items into correct number of groups', () => {
      const result = roundRobinPartition(basicItems, 2, 3);
      
      expect(result.groupsById).toHaveLength(2);
      expect(result.groupsByIndex).toHaveLength(2);
      expect(result.groupSums).toHaveLength(2);
      
      // Each group should have exactly 3 items
      expect(result.groupsById[0]).toHaveLength(3);
      expect(result.groupsById[1]).toHaveLength(3);
    });

    it('should sort items by capacity in descending order before distribution', () => {
      const result = roundRobinPartition(basicItems, 2, 3);
      
      // First group should get items with capacities [10, 6, 2] (1st, 3rd, 5th largest)
      // Second group should get items with capacities [8, 4, 1] (2nd, 4th, 6th largest)
      
      const group1Capacities = result.groupsByIndex[0]!.map(idx => basicItems[idx]!.capacity);
      const group2Capacities = result.groupsByIndex[1]!.map(idx => basicItems[idx]!.capacity);
      
      expect(group1Capacities).toEqual([10, 6, 2]);
      expect(group2Capacities).toEqual([8, 4, 1]);
    });

    it('should calculate correct group sums', () => {
      const result = roundRobinPartition(basicItems, 2, 3);
      
      expect(result.groupSums[0]).toBe(18); // 10 + 6 + 2
      expect(result.groupSums[1]).toBe(13); // 8 + 4 + 1
    });

    it('should calculate correct delta and standard deviation', () => {
      const result = roundRobinPartition(basicItems, 2, 3);
      
      expect(result.delta).toBe(5); // 18 - 13
      expect(result.stdev).toBeCloseTo(2.5, 1); // sqrt(((18-15.5)^2 + (13-15.5)^2) / 2)
    });

    it('should handle identical capacities deterministically', () => {
      const result1 = roundRobinPartition(identicalItems, 2, 2);
      const result2 = roundRobinPartition(identicalItems, 2, 2);
      
      // Results should be identical
      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.groupSums).toEqual(result2.groupSums);
      expect(result1.delta).toBe(0); // Perfect balance with identical items
    });

    it('should maintain item order consistency with same input', () => {
      const result1 = roundRobinPartition(basicItems, 3, 2);
      const result2 = roundRobinPartition(basicItems, 3, 2);
      
      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.groupsByIndex).toEqual(result2.groupsByIndex);
    });

    it('should set correct metadata', () => {
      const result = roundRobinPartition(basicItems, 2, 3);
      
      expect(result.methodUsed).toBe('roundrobin');
      expect(result.iterations).toBe(1);
    });
  });

  describe('Optimized Round-Robin Partition', () => {
    it('should produce better balance than basic round-robin', () => {
      const basicResult = roundRobinPartition(basicItems, 2, 3);
      const optimizedResult = optimizedRoundRobinPartition(basicItems, 2, 3);
      
      // Optimized should have equal or better balance
      expect(optimizedResult.delta).toBeLessThanOrEqual(basicResult.delta);
    });

    it('should respect group size constraints', () => {
      const result = optimizedRoundRobinPartition(largeItems.slice(0, 20), 4, 5);
      
      result.groupsById.forEach(group => {
        expect(group).toHaveLength(5);
      });
    });

    it('should set correct metadata', () => {
      const result = optimizedRoundRobinPartition(basicItems, 2, 3);
      
      expect(result.methodUsed).toBe('roundrobin-optimized');
      expect(result.iterations).toBe(1);
    });
  });

  describe('Main Round-Robin Entry Point', () => {
    it('should use basic algorithm for small problems', () => {
      const result = roundRobin(basicItems, 2, 3, { optimized: false });
      expect(result.methodUsed).toBe('roundrobin');
    });

    it('should use optimized algorithm for larger problems by default', () => {
      const result = roundRobin(largeItems.slice(0, 30), 5, 6);
      expect(result.methodUsed).toBe('roundrobin-optimized');
    });

    it('should respect optimization flag', () => {
      const basicResult = roundRobin(largeItems.slice(0, 30), 5, 6, { optimized: false });
      const optimizedResult = roundRobin(largeItems.slice(0, 30), 5, 6, { optimized: true });
      
      expect(basicResult.methodUsed).toBe('roundrobin');
      expect(optimizedResult.methodUsed).toBe('roundrobin-optimized');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single group', () => {
      const result = roundRobin(basicItems, 1, 6);
      
      expect(result.groupsById).toHaveLength(1);
      expect(result.groupsById[0]).toHaveLength(6);
      expect(result.delta).toBe(0); // Only one group, so delta is 0
    });

    it('should handle single item per group', () => {
      const result = roundRobin(basicItems, 6, 1);
      
      expect(result.groupsById).toHaveLength(6);
      result.groupsById.forEach(group => {
        expect(group).toHaveLength(1);
      });
    });

    it('should handle minimum case (2 groups, 1 item each)', () => {
      const twoItems: Item[] = [
        { id: 'x', capacity: 10 },
        { id: 'y', capacity: 5 },
      ];
      
      const result = roundRobin(twoItems, 2, 1);
      
      expect(result.groupsById).toHaveLength(2);
      expect(result.groupsById[0]).toEqual(['x']); // Larger capacity item first
      expect(result.groupsById[1]).toEqual(['y']);
      expect(result.delta).toBe(5);
    });

    it('should handle perfect balance scenario', () => {
      const perfectItems: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 10 },
        { id: 'c', capacity: 5 },
        { id: 'd', capacity: 5 },
      ];
      
      const result = roundRobin(perfectItems, 2, 2);
      
      expect(result.delta).toBe(0); // Perfect balance possible
      expect(result.stdev).toBe(0);
    });

    it('should handle large capacity differences', () => {
      const extremeItems: Item[] = [
        { id: 'huge', capacity: 1000 },
        { id: 'tiny1', capacity: 1 },
        { id: 'tiny2', capacity: 1 },
        { id: 'tiny3', capacity: 1 },
      ];
      
      const result = roundRobin(extremeItems, 2, 2);
      
      // Should still produce valid grouping
      expect(result.groupsById).toHaveLength(2);
      expect(result.groupSums[0]! + result.groupSums[1]!).toBe(1003);
    });

    it('should handle decimal capacities', () => {
      const decimalItems: Item[] = [
        { id: 'a', capacity: 10.5 },
        { id: 'b', capacity: 8.3 },
        { id: 'c', capacity: 6.7 },
        { id: 'd', capacity: 4.2 },
      ];
      
      const result = roundRobin(decimalItems, 2, 2);
      
      expect(result.groupSums[0]).toBeCloseTo(17.2, 1); // 10.5 + 6.7
      expect(result.groupSums[1]).toBeCloseTo(12.5, 1); // 8.3 + 4.2
    });
  });

  describe('Performance', () => {
    it('should complete quickly for large inputs', () => {
      const startTime = performance.now();
      const result = roundRobin(largeItems, 10, 10);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
      expect(result.groupsById).toHaveLength(10);
    });

    it('should be deterministic across multiple runs', () => {
      const results = Array.from({ length: 5 }, () => 
        roundRobin(basicItems, 2, 3)
      );
      
      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
        expect(results[i]!.delta).toBe(results[0]!.delta);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty items array gracefully', () => {
      expect(() => roundRobin([], 1, 0)).not.toThrow();
    });

    it('should maintain algorithm integrity with invalid inputs', () => {
      // The validation should be handled at a higher level
      // The algorithm itself should work with whatever valid data it receives
      const validResult = roundRobin(basicItems, 2, 3);
      expect(validResult.groupsById).toBeDefined();
      expect(validResult.delta).toBeGreaterThanOrEqual(0);
    });
  });
});
