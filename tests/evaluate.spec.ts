import { describe, it, expect } from 'vitest';
import { 
  evaluateGrouping,
  evaluateGroupingPrecise,
  calculateBalanceScore,
  compareGroupings,
  satisfiesBalanceConstraints,
  summarizeEvaluation,
  validateGrouping,
  kahanSum
} from '../src/algorithms/evaluate.js';
import { Item } from '../src/types.js';

describe('Evaluation Functions', () => {
  const basicItems: Item[] = [
    { id: 'a', capacity: 10 },
    { id: 'b', capacity: 8 },
    { id: 'c', capacity: 6 },
    { id: 'd', capacity: 4 },
    { id: 'e', capacity: 2 },
    { id: 'f', capacity: 1 },
  ];

  describe('evaluateGrouping', () => {
    it('should calculate correct metrics for balanced groups', () => {
      const groupsByIndex = [[0, 1, 2], [3, 4, 5]]; // [10,8,6] vs [4,2,1] -> 24 vs 7
      const result = evaluateGrouping(basicItems, groupsByIndex);

      expect(result.groupSums).toEqual([24, 7]);
      expect(result.delta).toBe(17);
      expect(result.mean).toBe(15.5);
      expect(result.totalCapacity).toBe(31);
      expect(result.stdev).toBeCloseTo(8.5, 1);
      expect(result.cv).toBeCloseTo(0.548, 2); // stdev/mean
    });

    it('should handle perfect balance', () => {
      const perfectItems: Item[] = [
        { id: 'a', capacity: 5 },
        { id: 'b', capacity: 5 },
        { id: 'c', capacity: 5 },
        { id: 'd', capacity: 5 },
      ];
      
      const groupsByIndex = [[0, 1], [2, 3]]; // [5,5] vs [5,5] -> 10 vs 10
      const result = evaluateGrouping(perfectItems, groupsByIndex);

      expect(result.groupSums).toEqual([10, 10]);
      expect(result.delta).toBe(0);
      expect(result.stdev).toBe(0);
      expect(result.cv).toBe(0);
    });

    it('should handle single group', () => {
      const groupsByIndex = [[0, 1, 2, 3, 4, 5]]; // All items in one group
      const result = evaluateGrouping(basicItems, groupsByIndex, {
        maxCacheItems: 0, // Disable cache to avoid interference
      });

      expect(result.groupSums).toEqual([31]);
      expect(result.delta).toBe(0); // Only one group, no delta
      expect(result.stdev).toBe(0);
      expect(result.mean).toBe(31);
    });

    it('should handle empty groups', () => {
      const groupsByIndex = [[], []]; // Two empty groups
      const result = evaluateGrouping(basicItems, groupsByIndex);

      expect(result.groupSums).toEqual([0, 0]);
      expect(result.delta).toBe(0);
      expect(result.stdev).toBe(0);
      expect(result.mean).toBe(0);
    });

    it('should handle decimal capacities precisely', () => {
      const decimalItems: Item[] = [
        { id: 'a', capacity: 10.5 },
        { id: 'b', capacity: 8.3 },
        { id: 'c', capacity: 6.7 },
        { id: 'd', capacity: 4.2 },
      ];
      
      const groupsByIndex = [[0, 1], [2, 3]]; // [10.5,8.3] vs [6.7,4.2] -> 18.8 vs 10.9
      const result = evaluateGrouping(decimalItems, groupsByIndex);

      expect(result.groupSums[0]).toBeCloseTo(18.8, 10);
      expect(result.groupSums[1]).toBeCloseTo(10.9, 10);
      expect(result.delta).toBeCloseTo(7.9, 10);
    });

    it('should throw for invalid group indices', () => {
      const groupsByIndex = [[0, 1], [2, 6]]; // Index 6 doesn't exist
      
      expect(() => evaluateGrouping(basicItems, groupsByIndex)).toThrow();
    });

    it('should throw for negative indices', () => {
      const groupsByIndex = [[0, 1], [-1, 2]]; // Negative index
      
      expect(() => evaluateGrouping(basicItems, groupsByIndex)).toThrow();
    });
  });

  describe('evaluateGroupingPrecise', () => {
    it('should use Kahan summation for better precision', () => {
      const precisionItems: Item[] = [
        { id: 'a', capacity: 0.1 },
        { id: 'b', capacity: 0.2 },
        { id: 'c', capacity: 0.3 },
        { id: 'd', capacity: 1e-10 },
      ];
      
      const groupsByIndex = [[0, 1], [2, 3]];
      const precise = evaluateGroupingPrecise(precisionItems, groupsByIndex);
      const regular = evaluateGrouping(precisionItems, groupsByIndex);

      // Both should be very close for this example
      expect(precise.groupSums[0]).toBeCloseTo(0.3, 15);
      expect(precise.groupSums[1]).toBeCloseTo(0.3 + 1e-10, 15);
      
      // Precise version should handle extreme values better
      expect(precise.totalCapacity).toBeCloseTo(regular.totalCapacity, 10);
    });
  });

  describe('kahanSum', () => {
    it('should sum small numbers accurately', () => {
      const values = [0.1, 0.2, 0.3];
      const result = kahanSum(values);
      
      expect(result).toBeCloseTo(0.6, 15);
    });

    it('should handle floating point precision issues', () => {
      const values = Array(1000).fill(0.1);
      const result = kahanSum(values);
      const naiveSum = values.reduce((a, b) => a + b, 0);
      
      expect(result).toBeCloseTo(100, 10);
      expect(result).toBeGreaterThan(naiveSum - 1e-10);
    });

    it('should handle empty array', () => {
      expect(kahanSum([])).toBe(0);
    });

    it('should handle single value', () => {
      expect(kahanSum([42.5])).toBe(42.5);
    });

    it('should handle negative values', () => {
      const values = [10, -5, 3, -2];
      expect(kahanSum(values)).toBe(6);
    });
  });

  describe('calculateBalanceScore', () => {
    it('should calculate score with default weights', () => {
      const evaluation = {
        groupSums: [10, 8],
        delta: 2,
        stdev: 1,
        mean: 9,
        totalCapacity: 18,
        cv: 1/9
      };
      
      const score = calculateBalanceScore(evaluation);
      
      // Default: deltaWeight=1, stdevWeight=1, cvWeight=0.5
      const expectedScore = 2 * 1 + 1 * 1 + (1/9) * 0.5;
      expect(score).toBeCloseTo(expectedScore, 10);
    });

    it('should use custom weights', () => {
      const evaluation = {
        groupSums: [10, 8],
        delta: 2,
        stdev: 1,
        mean: 9,
        totalCapacity: 18,
        cv: 1/9
      };
      
      const score = calculateBalanceScore(evaluation, {
        deltaWeight: 2,
        stdevWeight: 0.5,
        cvWeight: 1
      });
      
      const expectedScore = 2 * 2 + 1 * 0.5 + (1/9) * 1;
      expect(score).toBeCloseTo(expectedScore, 10);
    });

    it('should handle perfect balance', () => {
      const evaluation = {
        groupSums: [10, 10, 10],
        delta: 0,
        stdev: 0,
        mean: 10,
        totalCapacity: 30,
        cv: 0
      };
      
      const score = calculateBalanceScore(evaluation);
      expect(score).toBe(0);
    });
  });

  describe('compareGroupings', () => {
    const eval1 = {
      groupSums: [10, 8],
      delta: 2,
      stdev: 1,
      mean: 9,
      totalCapacity: 18,
      cv: 1/9
    };

    const eval2 = {
      groupSums: [9, 9],
      delta: 0,
      stdev: 0,
      mean: 9,
      totalCapacity: 18,
      cv: 0
    };

    it('should return negative when first is better (lower score)', () => {
      // eval2 is better (perfect balance)
      const result = compareGroupings(eval2, eval1);
      expect(result).toBeLessThan(0);
    });

    it('should return positive when first is worse (higher score)', () => {
      const result = compareGroupings(eval1, eval2);
      expect(result).toBeGreaterThan(0);
    });

    it('should return zero for identical evaluations', () => {
      const result = compareGroupings(eval1, eval1);
      expect(result).toBe(0);
    });

    it('should use custom weights for comparison', () => {
      const options = { deltaWeight: 0, stdevWeight: 1, cvWeight: 0 };
      
      // With only stdev weight, eval2 (stdev=0) should be much better
      const result = compareGroupings(eval1, eval2, options);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('satisfiesBalanceConstraints', () => {
    const evaluation = {
      groupSums: [10, 8, 6],
      delta: 4,
      stdev: 2,
      mean: 8,
      totalCapacity: 24,
      cv: 0.25
    };

    it('should return true when all constraints are satisfied', () => {
      const constraints = {
        maxDelta: 5,
        maxStdev: 3,
        maxCV: 0.3
      };
      
      expect(satisfiesBalanceConstraints(evaluation, constraints)).toBe(true);
    });

    it('should return false when delta constraint is violated', () => {
      const constraints = {
        maxDelta: 3, // evaluation.delta = 4 > 3
        maxStdev: 3,
        maxCV: 0.3
      };
      
      expect(satisfiesBalanceConstraints(evaluation, constraints)).toBe(false);
    });

    it('should return false when stdev constraint is violated', () => {
      const constraints = {
        maxDelta: 5,
        maxStdev: 1, // evaluation.stdev = 2 > 1
        maxCV: 0.3
      };
      
      expect(satisfiesBalanceConstraints(evaluation, constraints)).toBe(false);
    });

    it('should return false when CV constraint is violated', () => {
      const constraints = {
        maxDelta: 5,
        maxStdev: 3,
        maxCV: 0.2 // evaluation.cv = 0.25 > 0.2
      };
      
      expect(satisfiesBalanceConstraints(evaluation, constraints)).toBe(false);
    });

    it('should return true with no constraints', () => {
      expect(satisfiesBalanceConstraints(evaluation, {})).toBe(true);
    });
  });

  describe('summarizeEvaluation', () => {
    it('should create readable summary', () => {
      const evaluation = {
        groupSums: [10.5, 8.3, 6.7],
        delta: 3.8,
        stdev: 1.9,
        mean: 8.5,
        totalCapacity: 25.5,
        cv: 0.224
      };
      
      const summary = summarizeEvaluation(evaluation);
      
      expect(summary).toContain('Groups: 3');
      expect(summary).toContain('25.50');
      expect(summary).toContain('3.80');
      expect(summary).toContain('1.90');
      expect(summary).toContain('22.4%'); // CV as percentage
    });

    it('should handle perfect balance summary', () => {
      const evaluation = {
        groupSums: [10, 10, 10],
        delta: 0,
        stdev: 0,
        mean: 10,
        totalCapacity: 30,
        cv: 0
      };
      
      const summary = summarizeEvaluation(evaluation);
      
      expect(summary).toContain('Groups: 3');
      expect(summary).toContain('Delta: 0.00');
      expect(summary).toContain('CV: 0.0%');
    });
  });

  describe('validateGrouping', () => {
    it('should validate correct grouping', () => {
      const groupsByIndex = [[0, 1, 2], [3, 4, 5]]; // Two groups of 3
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect wrong group sizes', () => {
      const groupsByIndex = [[0, 1], [2, 3, 4, 5]]; // Groups of 2 and 4
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Group 0 has 2 items, expected 3');
      expect(result.errors).toContain('Group 1 has 4 items, expected 3');
    });

    it('should detect missing items', () => {
      const groupsByIndex = [[0, 1, 2], [4, 5]]; // Item 3 missing
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('items assigned, expected'))).toBe(true);
    });

    it('should detect duplicate assignments', () => {
      const groupsByIndex = [[0, 1, 2], [2, 3, 4]]; // Item 2 appears twice
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('assigned to multiple groups'))).toBe(true);
    });

    it('should detect invalid indices', () => {
      const groupsByIndex = [[0, 1, 2], [3, 4, 10]]; // Index 10 out of bounds
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid item index'))).toBe(true);
    });

    it('should handle empty groups', () => {
      const groupsByIndex = [[], [0, 1, 2]]; // One empty group
      const result = validateGrouping(basicItems, groupsByIndex, 3);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Group 0 has 0 items, expected 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely large capacity differences', () => {
      const extremeItems: Item[] = [
        { id: 'tiny', capacity: 1e-10 },
        { id: 'huge', capacity: 1e10 },
        { id: 'normal1', capacity: 100 },
        { id: 'normal2', capacity: 200 },
      ];
      
      const groupsByIndex = [[0, 1], [2, 3]]; // [tiny, huge] vs [normal1, normal2]
      const result = evaluateGrouping(extremeItems, groupsByIndex);
      
      expect(result.groupSums[0]).toBeCloseTo(1e10, -5); // Dominated by huge
      expect(result.groupSums[1]).toBe(300);
      expect(result.delta).toBeCloseTo(1e10 - 300, -5);
    });

    it('should handle single item groups', () => {
      const singleItems: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 5 },
      ];
      
      const groupsByIndex = [[0], [1]]; // One item per group
      const result = evaluateGrouping(singleItems, groupsByIndex);
      
      expect(result.groupSums).toEqual([10, 5]);
      expect(result.delta).toBe(5);
      expect(result.mean).toBe(7.5);
    });

    it('should handle zero capacity items', () => {
      const zeroItems: Item[] = [
        { id: 'zero1', capacity: 0 },
        { id: 'zero2', capacity: 0 },
        { id: 'normal', capacity: 10 },
        { id: 'zero3', capacity: 0 },
      ];
      
      const groupsByIndex = [[0, 1], [2, 3]]; // [0,0] vs [10,0]
      const result = evaluateGrouping(zeroItems, groupsByIndex);
      
      expect(result.groupSums).toEqual([0, 10]);
      expect(result.delta).toBe(10);
    });
  });

  describe('GPU Evaluation Flags', () => {
    it('evaluateGrouping: GPU flag should produce same results as CPU for small inputs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];
      const groupsByIndex = [[0, 1], [2, 3]];

      const cpu = evaluateGrouping(items, groupsByIndex);
      const gpu = evaluateGrouping(items, groupsByIndex, { useGpu: true, minSizeForGpu: 1 });

      expect(gpu.groupSums).toEqual(cpu.groupSums);
      expect(gpu.delta).toBe(cpu.delta);
      expect(gpu.stdev).toBeCloseTo(cpu.stdev, 12);
      expect(gpu.mean).toBeCloseTo(cpu.mean, 12);
      expect(gpu.totalCapacity).toBeCloseTo(cpu.totalCapacity, 12);
    });

    it('evaluateGroupingPrecise: GPU flag should produce same results as CPU-precise for small inputs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 0.1 },
        { id: 'b', capacity: 0.2 },
        { id: 'c', capacity: 0.3 },
        { id: 'd', capacity: 0.4 },
      ];
      const groupsByIndex = [[0, 1], [2, 3]];

      const cpuPrecise = evaluateGroupingPrecise(items, groupsByIndex);
      const gpuPrecise = evaluateGroupingPrecise(items, groupsByIndex, { useGpu: true, minSizeForGpu: 1 });

      expect(gpuPrecise.groupSums[0]).toBeCloseTo(cpuPrecise.groupSums[0], 12);
      expect(gpuPrecise.groupSums[1]).toBeCloseTo(cpuPrecise.groupSums[1], 12);
      expect(gpuPrecise.delta).toBeCloseTo(cpuPrecise.delta, 12);
      expect(gpuPrecise.stdev).toBeCloseTo(cpuPrecise.stdev, 12);
      expect(gpuPrecise.mean).toBeCloseTo(cpuPrecise.mean, 12);
      expect(gpuPrecise.totalCapacity).toBeCloseTo(cpuPrecise.totalCapacity, 12);
    });
  });
});
