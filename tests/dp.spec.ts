import { describe, it, expect } from 'vitest';
import { dp } from '../src/algorithms/dp.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('dp', () => {
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

  it('scaling approach works for small problems', () => {
    const result = dp(smallItems, 2, 2, {
      enableScaling: true,
      enableMeetInMiddle: false,
      enableBranchAndBound: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('dp-integer-scaled');
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('meet-in-middle approach works for medium problems', () => {
    const result = dp(mediumItems, 2, 4, {
      enableScaling: false,
      enableMeetInMiddle: true,
      enableBranchAndBound: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('dp-integer-scaled');
  });

  it('branch-and-bound works for very small problems', () => {
    const tinyItems: Item[] = [
      { id: 'a', capacity: 5 },
      { id: 'b', capacity: 4 },
      { id: 'c', capacity: 3 },
    ];

    const result = dp(tinyItems, 1, 3, {
      enableScaling: false,
      enableMeetInMiddle: false,
      enableBranchAndBound: true,
    });

    expect(result.groupsByIndex).toHaveLength(1);
    expect(result.groupsByIndex[0]).toHaveLength(3);
    expect(result.method).toBe('dp-integer-scaled');
  });

  it('fallback works when other methods fail', () => {
    const result = dp(mediumItems, 2, 4, {
      enableScaling: false,
      enableMeetInMiddle: false,
      enableBranchAndBound: false,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('dp-integer-scaled');
  });

  it('respects time limits and max iterations', () => {
    const result = dp(mediumItems, 2, 4, {
      maxIters: 10,
      timeLimitMs: 1, // Very short time limit
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBeLessThanOrEqual(10);
  });

  it('maintains exact group size constraints', () => {
    const result = dp(mediumItems, 4, 2, {
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
    });

    expect(result.groupsByIndex).toHaveLength(4);
    for (let g = 0; g < 4; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(2);
    }
  });

  it('produces valid grouping with all items assigned', () => {
    const result = dp(mediumItems, 2, 4, {
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
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

  it('handles edge case with single group', () => {
    const result = dp(smallItems, 1, 4, {
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
    });

    expect(result.groupsByIndex).toHaveLength(1);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.method).toBeDefined();
  });

  it('handles edge case with single item per group', () => {
    const result = dp(smallItems, 4, 1, {
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
    });

    expect(result.groupsByIndex).toHaveLength(4);
    for (let g = 0; g < 4; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(1);
    }
  });

  it('produces balanced groupings', () => {
    const result = dp(mediumItems, 2, 4, {
      enableScaling: true,
      enableMeetInMiddle: true,
      enableBranchAndBound: true,
    });

    // Calculate group sums
    const groupSums = result.groupSums;
    expect(groupSums).toHaveLength(2);
    
    // Check that groups are reasonably balanced
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;
    
    // Delta should be reasonable (not more than 50% of average)
    const averageSum = groupSums.reduce((a, b) => a + b, 0) / groupSums.length;
    expect(delta).toBeLessThanOrEqual(averageSum * 0.5);
  });
});
