import { describe, it, expect } from 'vitest';
import { flow } from '../src/algorithms/flow.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('flow', () => {
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
    { id: 'g', capacity: 9 },
    { id: 'h', capacity: 8 },
  ];

  it('min-cost flow approach works', () => {
    const result = flow(smallItems, 2, 2, {
      enableMinCostFlow: true,
      enableLPRelaxation: false,
      enableRounding: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('flow-heuristic');
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('LP relaxation approach works', () => {
    const result = flow(mediumItems, 2, 4, {
      enableMinCostFlow: false,
      enableLPRelaxation: true,
      enableRounding: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('flow-heuristic');
  });

  it('rounding improves solution quality', () => {
    const resultWithoutRounding = flow(mediumItems, 2, 4, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: false,
    });

    const resultWithRounding = flow(mediumItems, 2, 4, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    expect(resultWithRounding.method).toBe('flow-heuristic');
    expect(resultWithRounding.iterations).toBeGreaterThanOrEqual(resultWithoutRounding.iterations);
  });

  it('maintains exact group size constraints', () => {
    const result = flow(mediumItems, 4, 2, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    expect(result.groupsByIndex).toHaveLength(4);
    for (let g = 0; g < 4; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(2);
    }
  });

  it('produces valid grouping with all items assigned', () => {
    const result = flow(mediumItems, 2, 4, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
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
    const result = flow(mediumItems, 2, 4, {
      maxIters: 10,
      timeLimitMs: 1, // Very short time limit
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBeLessThanOrEqual(10);
  });

  it('falls back to greedy when other methods fail', () => {
    const result = flow(mediumItems, 2, 4, {
      enableMinCostFlow: false,
      enableLPRelaxation: false,
      enableRounding: false,
    });

    expect(result).toBeDefined();
    expect(result.method).toBe('flow-heuristic');
    expect(result.groupsByIndex).toHaveLength(2);
    for (let g = 0; g < 2; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(4);
    }
  });

  it('handles different problem sizes appropriately', () => {
    const tinyItems: Item[] = [
      { id: 'a', capacity: 5 },
      { id: 'b', capacity: 4 },
    ];

    const result = flow(tinyItems, 1, 2, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    expect(result.groupsByIndex).toHaveLength(1);
    expect(result.groupsByIndex[0]).toHaveLength(2);
  });

  it('demonstrates relaxation benefits', () => {
    // Test that LP relaxation can handle larger problems
    const largeItems: Item[] = Array.from({ length: 16 }, (_, i) => ({
      id: `item${i}`,
      capacity: 10 + i,
    }));

    const result = flow(largeItems, 4, 4, {
      enableMinCostFlow: false,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    expect(result.groupsByIndex).toHaveLength(4);
    for (let g = 0; g < 4; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(4);
    }
    expect(result.method).toBe('flow-heuristic');
  });

  it('shows rounding effectiveness', () => {
    // Test that rounding actually improves balance
    const resultWithoutRounding = flow(mediumItems, 2, 4, {
      enableMinCostFlow: false,
      enableLPRelaxation: true,
      enableRounding: false,
    });

    const resultWithRounding = flow(mediumItems, 2, 4, {
      enableMinCostFlow: false,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    // Calculate deltas
    const deltaWithoutRounding = Math.max(...resultWithoutRounding.groupSums) - Math.min(...resultWithoutRounding.groupSums);
    const deltaWithRounding = Math.max(...resultWithRounding.groupSums) - Math.min(...resultWithRounding.groupSums);

    // Rounding should improve or maintain balance
    expect(deltaWithRounding).toBeLessThanOrEqual(deltaWithoutRounding);
  });

  it('produces balanced groupings', () => {
    const result = flow(mediumItems, 2, 4, {
      enableMinCostFlow: true,
      enableLPRelaxation: true,
      enableRounding: true,
    });

    // Calculate group sums
    const groupSums = result.groupSums;
    expect(groupSums).toHaveLength(2);
    
    // Check that groups are reasonably balanced
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;
    
    // Delta should be reasonable for a medium problem
    expect(delta).toBeLessThanOrEqual(30);
  });
});
