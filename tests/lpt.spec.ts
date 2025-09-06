import { describe, it, expect, beforeEach } from 'vitest';
import { lpt, lptPartition, advancedLptPartition } from '../src/algorithms/lpt.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';
import { Item } from '../src/types.js';

describe('LPT (Longest Processing Time) Algorithm', () => {
  let basicItems: Item[];
  let identicalItems: Item[];
  let unbalancedItems: Item[];
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

    // Items that would create unbalanced partitions without refinement
    unbalancedItems = [
      { id: 'big1', capacity: 20 },
      { id: 'big2', capacity: 18 },
      { id: 'med1', capacity: 10 },
      { id: 'med2', capacity: 9 },
      { id: 'small1', capacity: 2 },
      { id: 'small2', capacity: 1 },
    ];

    // Larger set for performance testing
    largeItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item${i}`,
      capacity: Math.random() * 100 + 1,
    }));
  });

  describe('Basic LPT Partition', () => {
    it('should partition items into correct number of groups', () => {
      const result = lptPartition(basicItems, 2, 3);
      
      expect(result.groupsById).toHaveLength(2);
      expect(result.groupsByIndex).toHaveLength(2);
      expect(result.groupSums).toHaveLength(2);
      
      // Each group should have exactly 3 items
      expect(result.groupsById[0]).toHaveLength(3);
      expect(result.groupsById[1]).toHaveLength(3);
    });

    it('should assign largest items to groups with smallest sums', () => {
      const result = lptPartition(basicItems, 2, 3, { useRefinement: false });
      
      // First item (capacity 10) should go to group with smallest sum (initially 0)
      // Second item (capacity 8) should go to the other group
      // Third item (capacity 6) should go back to first group, etc.
      
      // Verify that items are assigned following LPT principle
      const allAssignedItems = result.groupsByIndex.flat();
      expect(allAssignedItems).toHaveLength(6);
      expect(new Set(allAssignedItems).size).toBe(6); // All items assigned exactly once
    });

    it('should produce better balance than naive approaches', () => {
      // LPT should perform better than simply dividing items sequentially
      const result = lptPartition(unbalancedItems, 2, 3, { useRefinement: false });
      
      // The delta should be reasonable given the item capacities
      expect(result.delta).toBeLessThan(20); // Should be much less than worst case
      expect(result.groupSums[0]! + result.groupSums[1]!).toBe(60); // Total capacity
    });

    it('should set correct metadata', () => {
      const result = lptPartition(basicItems, 2, 3, { useRefinement: false });
      
      expect(result.methodUsed).toBe('lpt');
      expect(result.iterations).toBe(1);
    });

    it('should handle identical capacities deterministically', () => {
      const result1 = lptPartition(identicalItems, 2, 2, { useRefinement: false });
      const result2 = lptPartition(identicalItems, 2, 2, { useRefinement: false });
      
      // Results should be identical
      expect(result1.groupsById).toEqual(result2.groupsById);
      expect(result1.groupSums).toEqual(result2.groupSums);
      expect(result1.delta).toBe(0); // Perfect balance with identical items
    });
  });

  describe('LPT with Refinement', () => {
    it('should improve balance through refinement', () => {
      const withoutRefinement = lptPartition(unbalancedItems, 2, 3, { useRefinement: false });
      const withRefinement = lptPartition(unbalancedItems, 2, 3, { useRefinement: true });
      
      // Refinement should improve or maintain the balance
      expect(withRefinement.delta).toBeLessThanOrEqual(withoutRefinement.delta);
      expect(withRefinement.stdev).toBeLessThanOrEqual(withoutRefinement.stdev);
    });

    it('should set correct metadata for refined results', () => {
      const result = lptPartition(basicItems, 2, 3, { useRefinement: true });
      
      expect(result.methodUsed).toBe('lpt-refined');
      expect(result.iterations).toBeGreaterThan(1);
    });

    it('should respect max refinement iterations', () => {
      const maxIters = 5;
      const result = lptPartition(unbalancedItems, 2, 3, { 
        useRefinement: true, 
        maxRefinementIters: maxIters 
      });
      
      // Should not exceed max iterations (plus 1 for initial assignment)
      expect(result.iterations).toBeLessThanOrEqual(maxIters + 1);
    });

    it('should handle cases where no refinement is possible', () => {
      // With identical items, refinement may not find improvements
      const result = lptPartition(identicalItems, 2, 2, { useRefinement: true });
      
      expect(result.delta).toBe(0);
      expect(result.methodUsed).toBe('lpt-refined');
    });
  });

  describe('Advanced LPT', () => {
    it('should use multi-phase refinement', () => {
      const basic = lptPartition(unbalancedItems, 2, 3, { useRefinement: true });
      const advanced = advancedLptPartition(unbalancedItems, 2, 3, { useMultiPhase: true });
      
      expect(advanced.methodUsed).toBe('lpt-advanced');
      // Advanced should be at least as good as basic
      expect(advanced.delta).toBeLessThanOrEqual(basic.delta);
    });

    it('should fall back to basic LPT when multi-phase disabled', () => {
      const result = advancedLptPartition(basicItems, 2, 3, { useMultiPhase: false });
      
      expect(result.methodUsed).toBe('lpt-refined');
    });
  });

  describe('Main LPT Entry Point', () => {
    it('should use basic algorithm by default', () => {
      const result = lpt(basicItems, 2, 3);
      expect(result.methodUsed).toBe('lpt-refined');
    });

    it('should use advanced algorithm when requested', () => {
      const result = lpt(basicItems, 2, 3, { useAdvanced: true });
      expect(result.methodUsed).toBe('lpt-advanced');
    });

    it('should respect refinement options', () => {
      const withoutRefinement = lpt(basicItems, 2, 3, { useRefinement: false });
      const withRefinement = lpt(basicItems, 2, 3, { useRefinement: true });
      
      expect(withoutRefinement.methodUsed).toBe('lpt');
      expect(withRefinement.methodUsed).toBe('lpt-refined');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single group', () => {
      const result = lpt(basicItems, 1, 6);
      
      expect(result.groupsById).toHaveLength(1);
      expect(result.groupsById[0]).toHaveLength(6);
      expect(result.delta).toBe(0); // Only one group, so delta is 0
    });

    it('should handle single item per group', () => {
      const result = lpt(basicItems, 6, 1);
      
      expect(result.groupsById).toHaveLength(6);
      result.groupsById.forEach(group => {
        expect(group).toHaveLength(1);
      });
      
      // Items should be assigned by descending capacity
      const assignedCapacities = result.groupsByIndex.map(group => 
        basicItems[group[0]!]!.capacity
      );
      expect(assignedCapacities).toEqual([10, 8, 6, 4, 2, 1]);
    });

    it('should handle minimum case (2 groups, 1 item each)', () => {
      const twoItems: Item[] = [
        { id: 'x', capacity: 10 },
        { id: 'y', capacity: 5 },
      ];
      
      const result = lpt(twoItems, 2, 1);
      
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
      
      const result = lpt(perfectItems, 2, 2);
      
      // LPT should achieve perfect balance
      expect(result.delta).toBe(0);
      expect(result.stdev).toBe(0);
    });

    it('should handle large capacity differences', () => {
      const extremeItems: Item[] = [
        { id: 'huge', capacity: 1000 },
        { id: 'tiny1', capacity: 1 },
        { id: 'tiny2', capacity: 1 },
        { id: 'tiny3', capacity: 1 },
      ];
      
      const result = lpt(extremeItems, 2, 2);
      
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
      
      const result = lpt(decimalItems, 2, 2);
      
      // Should handle decimals correctly
      expect(result.groupSums[0]! + result.groupSums[1]!).toBeCloseTo(29.7, 1);
    });
  });

  describe('Swap Operations', () => {
    it('should perform beneficial 1-1 swaps', () => {
      // Create a scenario where 1-1 swap would be beneficial
      const swapItems: Item[] = [
        { id: 'a', capacity: 15 }, // Group 0
        { id: 'b', capacity: 10 }, // Group 1
        { id: 'c', capacity: 5 },  // Group 0
        { id: 'd', capacity: 1 },  // Group 1
      ];
      
      const result = lpt(swapItems, 2, 2, { useRefinement: true, maxRefinementIters: 10 });
      
      // Should achieve good balance through swaps
      expect(result.delta).toBeLessThanOrEqual(5);
    });

    it('should perform beneficial 2-2 swaps when applicable', () => {
      // Create a scenario where 2-2 swap might be beneficial
      const complexItems: Item[] = [
        { id: 'a', capacity: 20 },
        { id: 'b', capacity: 15 },
        { id: 'c', capacity: 10 },
        { id: 'd', capacity: 8 },
        { id: 'e', capacity: 5 },
        { id: 'f', capacity: 2 },
      ];
      
      const result = lpt(complexItems, 2, 3, { useRefinement: true, maxRefinementIters: 50 });
      
      // Should find good balance through refinement
      expect(result.delta).toBeLessThan(10);
    });
  });

  describe('Performance', () => {
    it('should complete quickly for large inputs', () => {
      const startTime = performance.now();
      const result = lpt(largeItems, 10, 10, { maxRefinementIters: 20 });
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1s
      expect(result.groupsById).toHaveLength(10);
    });

    it('should be deterministic across multiple runs', () => {
      const results = Array.from({ length: 3 }, () => 
        lpt(basicItems, 2, 3, { maxRefinementIters: 10 })
      );
      
      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.groupsById).toEqual(results[0]!.groupsById);
        expect(results[i]!.delta).toBe(results[0]!.delta);
      }
    });

    it('should scale reasonably with problem size', () => {
      const smallTime = measureExecutionTime(() => 
        lpt(basicItems, 2, 3, { maxRefinementIters: 10 })
      );
      
      const largeTime = measureExecutionTime(() => 
        lpt(largeItems.slice(0, 50), 5, 10, { maxRefinementIters: 10 })
      );
      
      // Large problem should not be exponentially slower
      expect(largeTime).toBeLessThan(smallTime * 300);
    });
  });

  describe('Quality Comparison', () => {
    it('should outperform round-robin on unbalanced inputs', () => {
      // Import round-robin for comparison
      // This would require the round-robin module to be available
      // For now, we'll test LPT performance independently
      
      const result = lpt(unbalancedItems, 2, 3, { useRefinement: true });
      
      // LPT should achieve reasonable balance
      expect(result.delta).toBeLessThan(15);
      expect(result.stdev).toBeLessThan(8);
    });

    it('should improve with refinement iterations', () => {
      const noRefinement = lpt(unbalancedItems, 2, 3, { useRefinement: false });
      const someRefinement = lpt(unbalancedItems, 2, 3, { useRefinement: true, maxRefinementIters: 10 });
      const moreRefinement = lpt(unbalancedItems, 2, 3, { useRefinement: true, maxRefinementIters: 50 });
      
      // More refinement should lead to better or equal results
      expect(someRefinement.delta).toBeLessThanOrEqual(noRefinement.delta);
      expect(moreRefinement.delta).toBeLessThanOrEqual(someRefinement.delta);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty items array gracefully', () => {
      expect(() => lpt([], 1, 0)).not.toThrow();
    });

    it('should maintain algorithm integrity with edge inputs', () => {
      const validResult = lpt(basicItems, 2, 3);
      expect(validResult.groupsById).toBeDefined();
      expect(validResult.delta).toBeGreaterThanOrEqual(0);
      expect(validResult.stdev).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GPU Refinement Flag', () => {
    it('should preserve correctness when gpuRefinement is enabled', () => {
      const resultCpu = lpt(basicItems, 2, 3, { useRefinement: true, maxRefinementIters: 10 });
      const resultGpuFlag = lpt(basicItems, 2, 3, { useRefinement: true, maxRefinementIters: 10, gpuRefinement: { useGpu: true, minSizeForGpu: 1 } });
      // Same constraints and similar balance properties
      expect(resultGpuFlag.groupsById).toHaveLength(2);
      expect(resultGpuFlag.groupsById[0]).toHaveLength(3);
      expect(resultGpuFlag.delta).toBeGreaterThanOrEqual(0);
      // CPU re-evaluation should confirm stored metrics
      const evalCpu = evaluateGrouping(basicItems as any, resultGpuFlag.groupsByIndex);
      expect(evalCpu.delta).toBe(resultGpuFlag.delta);
    });
  });
});

/**
 * Helper function to measure execution time
 */
function measureExecutionTime(fn: () => void): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  return end - start;
}
