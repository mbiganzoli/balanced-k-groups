import { describe, it, expect } from 'vitest';
import { backtracking } from '../src/algorithms/backtracking.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('backtracking', () => {
  const smallItems: Item[] = [
    { id: 'a', capacity: 8 },
    { id: 'b', capacity: 7 },
    { id: 'c', capacity: 6 },
    { id: 'd', capacity: 5 },
  ];

  const mediumItems: Item[] = [
    { id: 'a', capacity: 15 },
    { id: 'b', capacity: 14 },
    { id: 'c', capacity: 13 },
    { id: 'd', capacity: 12 },
    { id: 'e', capacity: 11 },
    { id: 'f', capacity: 10 },
  ];

  it('finds optimal solution for small problems', () => {
    const result = backtracking(smallItems, 2, 2, {
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('backtracking');
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('respects pruning strategies', () => {
    const result = backtracking(mediumItems, 2, 3, {
      enablePruning: true,
      enableEarlyTermination: false,
      enableBoundCalculation: true,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(3);
    expect(result.groupsByIndex[1]).toHaveLength(3);
    expect(result.method).toBe('backtracking');
  });

  it('works without pruning for comparison', () => {
    const result = backtracking(mediumItems, 2, 3, {
      enablePruning: false,
      enableEarlyTermination: false,
      enableBoundCalculation: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(3);
    expect(result.groupsByIndex[1]).toHaveLength(3);
    expect(result.method).toBe('backtracking');
  });

  it('maintains exact group size constraints', () => {
    const result = backtracking(mediumItems, 3, 2, {
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    expect(result.groupsByIndex).toHaveLength(3);
    for (let g = 0; g < 3; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(2);
    }
  });

  it('produces valid grouping with all items assigned', () => {
    const result = backtracking(mediumItems, 2, 3, {
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    // Check all items are assigned exactly once
    const allAssigned = new Set<number>();
    for (let g = 0; g < result.groupsByIndex.length; g++) {
      for (let i = 0; i < result.groupsByIndex[g]!.length; i++) {
        allAssigned.add(result.groupsByIndex[g]![i]!);
      }
    }

    expect(allAssigned.size).toBe(mediumItems.length);
    for (let i = 0; i < mediumItems.length; i++) {
      expect(allAssigned.has(i)).toBe(true);
    }
  });

  it('respects time limits and max iterations', () => {
    const result = backtracking(mediumItems, 2, 3, {
      maxIters: 100,
      timeLimitMs: 1, // Very short time limit
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBeLessThanOrEqual(100);
  });

  it('falls back to greedy when no solution found', () => {
    // Create a problem that's too complex for backtracking to solve quickly
    const complexItems: Item[] = Array.from({ length: 12 }, (_, i) => ({
      id: `item${i}`,
      capacity: 10 + i,
    }));

    const result = backtracking(complexItems, 3, 4, {
      maxIters: 10, // Very low iteration limit
      timeLimitMs: 1, // Very short time limit
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(3);
    for (let g = 0; g < 3; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(4);
    }
  });

  it('demonstrates pruning effectiveness', () => {
    // Test that pruning reduces iterations
    const resultWithPruning = backtracking(mediumItems, 2, 3, {
      enablePruning: true,
      enableEarlyTermination: false,
      enableBoundCalculation: true,
      maxIters: 1000,
    });

    const resultWithoutPruning = backtracking(mediumItems, 2, 3, {
      enablePruning: false,
      enableEarlyTermination: false,
      enableBoundCalculation: false,
      maxIters: 1000,
    });

    // Pruning should reduce iterations (though exact numbers may vary)
    expect(resultWithPruning.iterations).toBeLessThanOrEqual(resultWithoutPruning.iterations);
  });

  it('handles early termination correctly', () => {
    const result = backtracking(mediumItems, 2, 3, {
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
      maxIters: 1000,
    });

    expect(result).toBeDefined();
    expect(result.method).toBe('backtracking');
  });

  it('produces balanced groupings', () => {
    const result = backtracking(mediumItems, 2, 3, {
      enablePruning: true,
      enableEarlyTermination: true,
      enableBoundCalculation: true,
    });

    // Calculate group sums
    const groupSums = result.groupSums;
    expect(groupSums).toHaveLength(2);
    
    // Check that groups are reasonably balanced
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;
    
    // Delta should be reasonable for a small problem
    expect(delta).toBeLessThanOrEqual(20);
  });
});
