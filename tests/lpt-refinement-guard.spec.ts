import { describe, it, expect } from 'vitest';
import { lptPartition } from '../src/algorithms/lpt.js';
import { Item } from '../src/types.js';

describe('LPT Refinement Guards', () => {
  it('should skip refinement for large group counts', () => {
    const items: Item[] = Array.from({ length: 100 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1 + (i % 10),
    }));

    // Test with many groups (exceeds maxGroupsForRefinement)
    const result = lptPartition(items, 25, 4, {
      useRefinement: true,
      maxGroupsForRefinement: 20, // Lower than 25 groups
      maxGroupSizeForRefinement: 50,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(25);
    expect(result.groupsByIndex.every(g => g.length === 4)).toBe(true);
    expect(result.methodUsed).toBe('lpt'); // Should use basic LPT without refinement
  });

  it('should skip refinement for large group sizes', () => {
    const items: Item[] = Array.from({ length: 100 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1 + (i % 5),
    }));

    // Test with large group size (exceeds maxGroupSizeForRefinement)
    const result = lptPartition(items, 4, 25, {
      useRefinement: true,
      maxGroupsForRefinement: 20,
      maxGroupSizeForRefinement: 20, // Lower than 25 group size
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(4);
    expect(result.groupsByIndex.every(g => g.length === 25)).toBe(true);
    expect(result.methodUsed).toBe('lpt'); // Should use basic LPT without refinement
  });

  it('should use refinement for small problems', () => {
    const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1 + (i % 5),
    }));

    // Test with small problem (within limits)
    const result = lptPartition(items, 4, 5, {
      useRefinement: true,
      maxGroupsForRefinement: 20,
      maxGroupSizeForRefinement: 50,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(4);
    expect(result.groupsByIndex.every(g => g.length === 5)).toBe(true);
    expect(result.methodUsed).toBe('lpt-refined'); // Should use refinement
  });

  it('should handle edge case with MAX_22_COMBINATIONS guard', () => {
    const items: Item[] = Array.from({ length: 40 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1,
    }));

    // Test with groups that would create many 2-2 combinations
    const result = lptPartition(items, 4, 10, {
      useRefinement: true,
      maxGroupsForRefinement: 20,
      maxGroupSizeForRefinement: 50,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(4);
    expect(result.groupsByIndex.every(g => g.length === 10)).toBe(true);
    // Should complete without errors even with many combinations
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('should gracefully degrade when refinement is disabled', () => {
    const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1 + (i % 3),
    }));

    const result = lptPartition(items, 4, 5, {
      useRefinement: false,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(4);
    expect(result.groupsByIndex.every(g => g.length === 5)).toBe(true);
    expect(result.methodUsed).toBe('lpt'); // Should use basic LPT
    expect(result.iterations).toBe(1); // No refinement iterations
  });
});
