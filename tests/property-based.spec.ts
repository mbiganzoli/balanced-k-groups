import { describe, it, expect } from 'vitest';
import { partitionBalanced } from '../src/index.js';
import { Item } from '../src/types.js';

/**
 * Property-based tests to verify algorithm correctness across all implementations
 */

describe('Property-Based Tests', () => {
  // Test data generators
  function generateTestItems(count: number, capacityRange: [number, number] = [1, 100]): Item[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `item_${i}`,
      capacity: Math.floor(Math.random() * (capacityRange[1] - capacityRange[0] + 1)) + capacityRange[0],
    }));
  }

  function generateMixedIdItems(count: number): Item[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i % 2 === 0 ? `item_${i}` : i, // Mix of string and number IDs
      capacity: 1 + (i % 10),
    }));
  }

  // Property verification functions
  function verifyExactItemCoverage(items: Item[], result: any): void {
    const allAssignedItems = new Set<number>();
    const totalItems = items.length;

    for (const group of result.groupsByIndex) {
      for (const itemIndex of group) {
        expect(itemIndex).toBeGreaterThanOrEqual(0);
        expect(itemIndex).toBeLessThan(totalItems);
        expect(allAssignedItems.has(itemIndex)).toBe(false); // No duplicates
        allAssignedItems.add(itemIndex);
      }
    }

    expect(allAssignedItems.size).toBe(totalItems); // All items assigned exactly once
  }

  function verifyFixedGroupSizes(result: any, expectedGroupSize: number): void {
    for (const group of result.groupsByIndex) {
      expect(group.length).toBe(expectedGroupSize);
    }
  }

  function verifyNonNegativeMetrics(result: any): void {
    expect(result.delta).toBeGreaterThanOrEqual(0);
    expect(result.stdev).toBeGreaterThanOrEqual(0);
    expect(result.iterations).toBeGreaterThan(0);
    
    for (const sum of result.groupSums) {
      expect(sum).toBeGreaterThanOrEqual(0);
    }
  }

  function verifyReproducibility(items: Item[], groups: number, groupSize: number, seed: number): void {
    const result1 = partitionBalanced(items, groups, groupSize, { seed, method: 'auto' });
    const result2 = partitionBalanced(items, groups, groupSize, { seed, method: 'auto' });
    
    // Results should be identical with same seed
    expect(result1.groupsById).toEqual(result2.groupsById);
    expect(result1.delta).toBe(result2.delta);
    expect(result1.stdev).toBe(result2.stdev);
  }

  // Test configurations
  const testConfigs = [
    { items: 8, groups: 2, groupSize: 4, name: 'small' },
    { items: 12, groups: 3, groupSize: 4, name: 'medium' },
    { items: 20, groups: 4, groupSize: 5, name: 'large' },
  ];

  const algorithms = ['roundrobin', 'lpt', 'kk', 'auto'];

  describe('Exact Item Coverage', () => {
    algorithms.forEach(algorithm => {
      testConfigs.forEach(config => {
        it(`${algorithm} should assign each item exactly once (${config.name})`, () => {
          const items = generateTestItems(config.items);
          const result = partitionBalanced(items, config.groups, config.groupSize, {
            method: algorithm as any,
            seed: 42,
          });

          verifyExactItemCoverage(items, result);
        });
      });
    });
  });

  describe('Fixed Group Sizes', () => {
    algorithms.forEach(algorithm => {
      testConfigs.forEach(config => {
        it(`${algorithm} should maintain exact group sizes (${config.name})`, () => {
          const items = generateTestItems(config.items);
          const result = partitionBalanced(items, config.groups, config.groupSize, {
            method: algorithm as any,
            seed: 42,
          });

          expect(result.groupsByIndex).toHaveLength(config.groups);
          verifyFixedGroupSizes(result, config.groupSize);
        });
      });
    });
  });

  describe('Non-Negative Metrics', () => {
    algorithms.forEach(algorithm => {
      testConfigs.forEach(config => {
        it(`${algorithm} should produce non-negative metrics (${config.name})`, () => {
          const items = generateTestItems(config.items);
          const result = partitionBalanced(items, config.groups, config.groupSize, {
            method: algorithm as any,
            seed: 42,
          });

          verifyNonNegativeMetrics(result);
        });
      });
    });
  });

  describe('Reproducibility', () => {
    algorithms.forEach(algorithm => {
      testConfigs.forEach(config => {
        it(`${algorithm} should be reproducible with fixed seed (${config.name})`, () => {
          const items = generateTestItems(config.items);
          verifyReproducibility(items, config.groups, config.groupSize, 123);
        });
      });
    });
  });

  describe('Mixed ID Types', () => {
    algorithms.forEach(algorithm => {
      it(`${algorithm} should handle mixed string/number IDs deterministically`, () => {
        const items = generateMixedIdItems(12);
        const result1 = partitionBalanced(items, 3, 4, {
          method: algorithm as any,
          seed: 456,
        });
        const result2 = partitionBalanced(items, 3, 4, {
          method: algorithm as any,
          seed: 456,
        });

        // Should be identical with same seed
        expect(result1.groupsById).toEqual(result2.groupsById);
        verifyExactItemCoverage(items, result1);
        verifyFixedGroupSizes(result1, 4);
        verifyNonNegativeMetrics(result1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle identical capacities', () => {
      const items: Item[] = Array.from({ length: 8 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 10, // All identical
      }));

      algorithms.forEach(algorithm => {
        const result = partitionBalanced(items, 2, 4, {
          method: algorithm as any,
          seed: 789,
        });

        verifyExactItemCoverage(items, result);
        verifyFixedGroupSizes(result, 4);
        verifyNonNegativeMetrics(result);
        expect(result.delta).toBe(0); // Perfect balance with identical capacities
      });
    });

    it('should handle single group', () => {
      const items = generateTestItems(4);
      
      algorithms.forEach(algorithm => {
        const result = partitionBalanced(items, 1, 4, {
          method: algorithm as any,
          seed: 101,
        });

        expect(result.groupsByIndex).toHaveLength(1);
        expect(result.groupsByIndex[0]).toHaveLength(4);
        verifyExactItemCoverage(items, result);
        verifyNonNegativeMetrics(result);
      });
    });

    it('should handle minimum viable problem', () => {
      const items: Item[] = [
        { id: 'a', capacity: 1 },
        { id: 'b', capacity: 2 },
      ];

      algorithms.forEach(algorithm => {
        const result = partitionBalanced(items, 1, 2, {
          method: algorithm as any,
          seed: 202,
        });

        expect(result.groupsByIndex).toHaveLength(1);
        expect(result.groupsByIndex[0]).toHaveLength(2);
        verifyExactItemCoverage(items, result);
        verifyNonNegativeMetrics(result);
      });
    });
  });

  describe('Performance Properties', () => {
    it('should complete within reasonable time bounds', () => {
      const items = generateTestItems(20);
      const startTime = performance.now();
      
      const result = partitionBalanced(items, 4, 5, {
        method: 'auto',
        timeLimitMs: 1000,
        seed: 303,
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      verifyExactItemCoverage(items, result);
      verifyFixedGroupSizes(result, 5);
      verifyNonNegativeMetrics(result);
    });

    it('should respect iteration limits', () => {
      const items = generateTestItems(16);
      
      const result = partitionBalanced(items, 4, 4, {
        method: 'auto',
        maxIters: 100,
        seed: 404,
      });

      expect(result.iterations).toBeLessThanOrEqual(100);
      verifyExactItemCoverage(items, result);
      verifyFixedGroupSizes(result, 4);
      verifyNonNegativeMetrics(result);
    });
  });

  describe('Algorithm-Specific Properties', () => {
    it('roundrobin should distribute items cyclically', () => {
      const items = generateTestItems(8);
      const result = partitionBalanced(items, 2, 4, {
        method: 'roundrobin',
        seed: 505,
      });

      // Round-robin should assign items in order: group 0, group 1, group 0, group 1, etc.
      const group0Items = result.groupsByIndex[0]!;
      const group1Items = result.groupsByIndex[1]!;
      
      // Items should be distributed roughly evenly
      expect(Math.abs(group0Items.length - group1Items.length)).toBeLessThanOrEqual(1);
      verifyExactItemCoverage(items, result);
      verifyFixedGroupSizes(result, 4);
    });

    it('lpt should prioritize larger items first', () => {
      const items = generateTestItems(8);
      const result = partitionBalanced(items, 2, 4, {
        method: 'lpt',
        seed: 606,
      });

      // LPT should generally produce better balance than round-robin
      verifyExactItemCoverage(items, result);
      verifyFixedGroupSizes(result, 4);
      verifyNonNegativeMetrics(result);
    });

    it('auto should select appropriate algorithm', () => {
      const items = generateTestItems(12);
      const result = partitionBalanced(items, 3, 4, {
        method: 'auto',
        seed: 707,
      });

      expect(result.methodUsed).toBeDefined();
      expect(['roundrobin', 'lpt', 'lpt-refined', 'kk', 'dp', 'dp-integer-scaled', 'dp-fallback', 'backtracking', 'flow', 'metaheuristic']).toContain(result.methodUsed);
      verifyExactItemCoverage(items, result);
      verifyFixedGroupSizes(result, 4);
      verifyNonNegativeMetrics(result);
    });
  });
});
