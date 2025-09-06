import { describe, it, expect } from 'vitest';
import { backtracking } from '../src/algorithms/backtracking.js';
import { Item } from '../src/types.js';

describe('Backtracking Recursion Guard', () => {
  it('should respect recursion depth limit', () => {
    const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1 + (i % 5), // Varying capacities
    }));

    // Test with very low recursion depth limit
    const result = backtracking(items, 4, 5, {
      maxRecursionDepth: 5, // Very low limit
      maxIters: 1000,
      timeLimitMs: 1000,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(4);
    expect(result.groupsByIndex.every(g => g.length === 5)).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(1100); // Allow some tolerance
  });

  it('should terminate early on tight budgets', () => {
    const items: Item[] = Array.from({ length: 16 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 10 + (i % 3),
    }));

    // Test with very tight time and iteration budgets
    const result = backtracking(items, 4, 4, {
      maxIters: 10, // Very low iteration limit
      timeLimitMs: 1, // Very low time limit
      maxRecursionDepth: 20,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBeLessThanOrEqual(50); // Allow some tolerance for tight budgets
    expect(result.method).toContain('backtracking');
  });

  it('should handle large problems with recursion limits', () => {
    const items: Item[] = Array.from({ length: 30 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 5 + (i % 4),
    }));

    // Test with moderate recursion depth limit
    const result = backtracking(items, 6, 5, {
      maxRecursionDepth: 30,
      maxIters: 5000,
      timeLimitMs: 2000,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(6);
    expect(result.groupsByIndex.every(g => g.length === 5)).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(5100); // Allow some tolerance
  });

  it('should fallback gracefully when recursion limit is exceeded', () => {
    const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
      id: `item_${i}`,
      capacity: 1,
    }));

    // Test with extremely low recursion depth
    const result = backtracking(items, 3, 4, {
      maxRecursionDepth: 1, // Extremely low
      maxIters: 100,
      timeLimitMs: 100,
    });

    expect(result).toBeDefined();
    expect(result.groupsByIndex).toHaveLength(3);
    // Should still produce a valid solution (fallback)
    expect(result.groupsByIndex.every(g => g.length === 4)).toBe(true);
  });
});
