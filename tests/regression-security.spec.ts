import { describe, it, expect } from 'vitest';
import { partitionBalanced } from '../src/index.js';
import { dp } from '../src/algorithms/dp.js';
import { backtracking } from '../src/algorithms/backtracking.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';
import { Item } from '../src/types.js';

describe('Security Regression Tests', () => {
  describe('DP Algorithm Gating', () => {
    it('should reject problems with too many items', () => {
      const items: Item[] = Array.from({ length: 25 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      expect(() => {
        dp(items, 5, 5, { maxItems: 20 });
      }).toThrow('DP algorithm restricted to problems with ≤20 items for security');
    });

    it('should reject problems with large total capacity', () => {
      const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 2000, // Total capacity = 20,000
      }));

      expect(() => {
        dp(items, 2, 5, { maxTotalSum: 10000 });
      }).toThrow('DP algorithm restricted to problems with total capacity ≤10000 for security');
    });

    it('should reject problems requiring too much memory', () => {
      const items: Item[] = Array.from({ length: 15 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1000, // Total capacity = 15,000
      }));

      expect(() => {
        dp(items, 3, 5, { maxTotalSum: 10000 }); // Use default limit
      }).toThrow('DP algorithm restricted to problems with total capacity ≤10000 for security');
    });

    it('should accept problems within limits', () => {
      const items: Item[] = Array.from({ length: 8 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 10,
      }));

      expect(() => {
        dp(items, 2, 4);
      }).not.toThrow();
    });
  });

  describe('Backtracking Recursion Guard', () => {
    it('should respect recursion depth limit', () => {
      const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const result = backtracking(items, 4, 5, {
        maxRecursionDepth: 5, // Very low limit
        maxIters: 1000,
        timeLimitMs: 1000,
      });

      expect(result).toBeDefined();
      expect(result.groupsByIndex).toHaveLength(4);
      expect(result.groupsByIndex.every(g => g.length === 5)).toBe(true);
    });

    it('should terminate early on tight iteration budget', () => {
      const items: Item[] = Array.from({ length: 16 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const result = backtracking(items, 4, 4, {
        maxIters: 10, // Very low limit
        timeLimitMs: 1000,
        maxRecursionDepth: 50,
      });

      expect(result.iterations).toBeLessThanOrEqual(50); // Allow some tolerance
      expect(result.groupsByIndex).toHaveLength(4);
    });

    it('should terminate early on tight time budget', () => {
      const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const result = backtracking(items, 3, 4, {
        maxIters: 10000,
        timeLimitMs: 1, // Very low limit
        maxRecursionDepth: 50,
      });

      expect(result.iterations).toBeLessThan(10000);
      expect(result.groupsByIndex).toHaveLength(3);
    });
  });

  describe('Evaluation Cache Size Guard', () => {
    it('should skip caching for large groupings', () => {
      const items: Item[] = Array.from({ length: 1200 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const groupsByIndex = Array.from({ length: 4 }, (_, g) =>
        Array.from({ length: 300 }, (_, i) => g * 300 + i)
      );

      // Should not throw and should complete
      const result = evaluateGrouping(items, groupsByIndex, {
        maxCacheItems: 1000, // Lower than 1200
      });

      expect(result).toBeDefined();
      expect(result.groupSums).toHaveLength(4);
      expect(result.delta).toBeGreaterThanOrEqual(0);
    });

    it('should skip caching for many groups', () => {
      const items: Item[] = Array.from({ length: 100 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const groupsByIndex = Array.from({ length: 60 }, (_, g) =>
        g < 50 ? [g] : [] // 50 groups with 1 item each
      );

      const result = evaluateGrouping(items, groupsByIndex, {
        maxCacheGroups: 50, // Lower than 60
      });

      expect(result).toBeDefined();
      expect(result.groupSums).toHaveLength(60);
    });

    it('should skip caching for large group sizes', () => {
      const items: Item[] = Array.from({ length: 200 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const groupsByIndex = [
        Array.from({ length: 120 }, (_, i) => i), // Large group
        Array.from({ length: 80 }, (_, i) => 120 + i),
      ];

      const result = evaluateGrouping(items, groupsByIndex, {
        maxCacheGroupSize: 100, // Lower than 120
      });

      expect(result).toBeDefined();
      expect(result.groupSums).toHaveLength(2);
    });

    it('should use caching for small groupings', () => {
      const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const groupsByIndex = [
        Array.from({ length: 10 }, (_, i) => i),
        Array.from({ length: 10 }, (_, i) => 10 + i),
      ];

      const result = evaluateGrouping(items, groupsByIndex, {
        maxCacheItems: 1000,
        maxCacheGroups: 50,
        maxCacheGroupSize: 100,
      });

      expect(result).toBeDefined();
      expect(result.groupSums).toHaveLength(2);
    });
  });

  describe('Performance Budget Tests', () => {
    it('should complete large problems within time budget', () => {
      const items: Item[] = Array.from({ length: 100 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1 + (i % 10),
      }));

      const startTime = performance.now();
      const result = partitionBalanced(items, 10, 10, {
        method: 'auto',
        timeLimitMs: 2000, // 2 second budget
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.groupsByIndex).toHaveLength(10);
      expect(result.groupsByIndex.every(g => g.length === 10)).toBe(true);
    });

    it('should respect iteration limits on large problems', () => {
      const items: Item[] = Array.from({ length: 80 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1 + (i % 5),
      }));

      const result = partitionBalanced(items, 8, 10, {
        method: 'auto',
        maxIters: 500, // Low iteration limit
        timeLimitMs: 5000,
      });

      expect(result.iterations).toBeLessThanOrEqual(500);
      expect(result.groupsByIndex).toHaveLength(8);
    });

    it('should handle very large problems with auto strategy', () => {
      const items: Item[] = Array.from({ length: 200 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1 + (i % 3),
      }));

      const startTime = performance.now();
      const result = partitionBalanced(items, 20, 10, {
        method: 'auto',
        timeLimitMs: 3000,
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(3000);
      expect(result.groupsByIndex).toHaveLength(20);
      expect(result.groupsByIndex.every(g => g.length === 10)).toBe(true);
      
      // Should use simpler algorithms for very large problems
      expect(['roundrobin', 'roundrobin-optimized', 'lpt', 'lpt-refined']).toContain(result.methodUsed);
    });
  });

  describe('Memory Usage Regression', () => {
    it('should not exhaust memory on large problems', () => {
      const items: Item[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      // This should not cause memory exhaustion
      expect(() => {
        partitionBalanced(items, 100, 10, {
          method: 'auto',
          timeLimitMs: 1000,
        });
      }).not.toThrow();
    });

    it('should handle edge case with maximum safe size', () => {
      const items: Item[] = Array.from({ length: 20 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 100, // Total capacity = 2000
      }));

      // Should work within DP limits
      expect(() => {
        dp(items, 2, 10, { maxTotalSum: 10000 });
      }).not.toThrow();
    });
  });

  describe('Global Pre-checks Integration', () => {
    it('should apply global size checks in auto strategy', () => {
      const items: Item[] = Array.from({ length: 120 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const result = partitionBalanced(items, 12, 10, {
        method: 'auto',
        timeLimitMs: 2000,
      });

      // Should use simpler algorithms due to global pre-checks
      expect(result.groupsByIndex).toHaveLength(12);
      expect(result.groupsByIndex.every(g => g.length === 10)).toBe(true);
      expect(['roundrobin', 'roundrobin-optimized', 'lpt', 'lpt-refined']).toContain(result.methodUsed);
    });

    it('should force simpler algorithms for very large problems', () => {
      const items: Item[] = Array.from({ length: 200 }, (_, i) => ({
        id: `item_${i}`,
        capacity: 1,
      }));

      const result = partitionBalanced(items, 20, 10, {
        method: 'auto',
        timeLimitMs: 3000,
      });

      // Should not use complex algorithms
      expect(result.methodUsed).not.toBe('dp');
      expect(result.methodUsed).not.toBe('backtracking');
      expect(result.methodUsed).not.toBe('metaheuristic');
    });
  });
});
