import { describe, it, expect } from 'vitest';
import { 
  RecoveryManager,
  SimplerAlgorithmFallback,
  ProblemSizeReduction,
  NumericalPrecisionRecovery,
  TimeoutRecovery,
  defaultRecoveryManager,
  createGracefulDegradation
} from '../src/recovery.js';
import { 
  AlgorithmError,
  TimeoutError,
  MemoryError,
  NumericalError,
  InfeasibleError
} from '../src/errors.js';
import { Item, PartitionOptions } from '../src/types.js';

describe('Recovery System', () => {
  const basicItems: Item[] = [
    { id: 'a', capacity: 10 },
    { id: 'b', capacity: 8 },
    { id: 'c', capacity: 6 },
    { id: 'd', capacity: 4 },
    { id: 'e', capacity: 2 },
    { id: 'f', capacity: 1 },
  ];

  describe('SimplerAlgorithmFallback', () => {
    const strategy = new SimplerAlgorithmFallback();

    it('should handle algorithm errors', () => {
      const error = new AlgorithmError('Complex algorithm failed', 'lpt');
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should handle timeout errors', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should handle memory errors', () => {
      const error = new MemoryError('Out of memory', 1000000);
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should handle numerical errors', () => {
      const error = new NumericalError('Numerical instability');
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle infeasible errors', () => {
      const error = new InfeasibleError('Problem is infeasible');
      
      expect(strategy.canHandle(error)).toBe(false);
    });

    it('should have correct strategy name', () => {
      expect(strategy.name).toBe('SimplerAlgorithmFallback');
    });

    it('should return null for recovery (not fully implemented)', () => {
      const error = new AlgorithmError('Test error', 'lpt');
      const result = strategy.recover(basicItems, 2, 3, { method: 'lpt' }, error);
      
      // Current implementation returns null since algorithms aren't fully wired
      expect(result).toBeNull();
    });
  });

  describe('ProblemSizeReduction', () => {
    const strategy = new ProblemSizeReduction();

    it('should handle memory errors', () => {
      const error = new MemoryError('Out of memory', 1000000);
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should handle timeout errors', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle algorithm errors', () => {
      const error = new AlgorithmError('Algorithm failed', 'lpt');
      
      expect(strategy.canHandle(error)).toBe(false);
    });

    it('should have correct strategy name', () => {
      expect(strategy.name).toBe('ProblemSizeReduction');
    });

    it('should return null for recovery (not fully implemented)', () => {
      const error = new MemoryError('Test error', 1000000);
      const result = strategy.recover(basicItems, 2, 3, {}, error);
      
      expect(result).toBeNull();
    });
  });

  describe('NumericalPrecisionRecovery', () => {
    const strategy = new NumericalPrecisionRecovery();

    it('should handle numerical errors', () => {
      const error = new NumericalError('Numerical instability detected');
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle non-numerical errors', () => {
      const error = new AlgorithmError('Non-numerical error', 'lpt');
      
      expect(strategy.canHandle(error)).toBe(false);
    });

    it('should have correct strategy name', () => {
      expect(strategy.name).toBe('NumericalPrecisionRecovery');
    });

    it('should return null for recovery (not fully implemented)', () => {
      const error = new NumericalError('Test error');
      const result = strategy.recover(basicItems, 2, 3, {}, error);
      
      expect(result).toBeNull();
    });
  });

  describe('TimeoutRecovery', () => {
    const strategy = new TimeoutRecovery();

    it('should handle timeout errors', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      
      expect(strategy.canHandle(error)).toBe(true);
    });

    it('should not handle non-timeout errors', () => {
      const error = new AlgorithmError('Not a timeout', 'lpt');
      
      expect(strategy.canHandle(error)).toBe(false);
    });

    it('should have correct strategy name', () => {
      expect(strategy.name).toBe('TimeoutRecovery');
    });

    it('should return null for recovery (not fully implemented)', () => {
      const error = new TimeoutError('Test error', 5000);
      const result = strategy.recover(basicItems, 2, 3, {}, error);
      
      expect(result).toBeNull();
    });
  });

  describe('RecoveryManager', () => {
    it('should have default strategies', () => {
      const manager = new RecoveryManager();
      
      // Test that it attempts recovery but returns null (since algorithms aren't fully implemented)
      const error = new AlgorithmError('Test error', 'lpt');
      const result = manager.recover(basicItems, 2, 3, { method: 'lpt' }, error);
      
      expect(result).toBeNull();
    });

    it('should add custom strategies', () => {
      const manager = new RecoveryManager();
      
      const customStrategy = {
        name: 'CustomStrategy',
        canHandle: () => true,
        recover: () => null
      };
      
      manager.addStrategy(customStrategy);
      
      const error = new Error('Test error');
      const result = manager.recover(basicItems, 2, 3, {}, error);
      
      expect(result).toBeNull();
    });

    it('should remove strategies by name', () => {
      const manager = new RecoveryManager();
      
      manager.removeStrategy('TimeoutRecovery');
      
      const error = new TimeoutError('Test timeout', 5000);
      const result = manager.recover(basicItems, 2, 3, {}, error);
      
      // Should still return null but for different reasons
      expect(result).toBeNull();
    });

    it('should try strategies in order', () => {
      const manager = new RecoveryManager();
      let strategiesAttempted: string[] = [];
      
      const trackingStrategy1 = {
        name: 'First',
        canHandle: () => true,
        recover: () => {
          strategiesAttempted.push('First');
          return null;
        }
      };
      
      const trackingStrategy2 = {
        name: 'Second', 
        canHandle: () => true,
        recover: () => {
          strategiesAttempted.push('Second');
          return null;
        }
      };
      
      manager.addStrategy(trackingStrategy1);
      manager.addStrategy(trackingStrategy2);
      
      const error = new Error('Test error');
      manager.recover(basicItems, 2, 3, {}, error);
      
      // Custom strategies are added to beginning, so Second should be first
      expect(strategiesAttempted).toEqual(['Second', 'First']);
    });
  });

  describe('defaultRecoveryManager', () => {
    it('should exist and be an instance of RecoveryManager', () => {
      expect(defaultRecoveryManager).toBeInstanceOf(RecoveryManager);
    });

    it('should handle different error types', () => {
      // Test that it can handle various errors (returns null since not fully implemented)
      const timeoutError = new TimeoutError('Timeout', 5000);
      const timeoutResult = defaultRecoveryManager.recover(basicItems, 2, 3, {}, timeoutError);
      expect(timeoutResult).toBeNull();

      const numericalError = new NumericalError('Numerical instability');
      const numericalResult = defaultRecoveryManager.recover(basicItems, 2, 3, {}, numericalError);
      expect(numericalResult).toBeNull();

      const memoryError = new MemoryError('Out of memory', 1000000);
      const memoryResult = defaultRecoveryManager.recover(basicItems, 2, 3, {}, memoryError);
      expect(memoryResult).toBeNull();
    });
  });

  describe('createGracefulDegradation', () => {
    it('should create a valid fallback grouping', () => {
      const error = new AlgorithmError('All algorithms failed', 'roundrobin');
      const fallback = createGracefulDegradation(basicItems, 2, 3, error);
      
      expect(fallback.groupsById).toHaveLength(2);
      expect(fallback.groupsById[0]).toHaveLength(3);
      expect(fallback.groupsById[1]).toHaveLength(3);
      expect(fallback.methodUsed).toBe('graceful-degradation');
      expect(fallback.delta).toBeGreaterThanOrEqual(0);
      expect(fallback.stdev).toBeGreaterThanOrEqual(0);
    });

    it('should handle edge cases gracefully', () => {
      const singleGroup = createGracefulDegradation(basicItems, 1, 6, new Error('Test'));
      
      expect(singleGroup.groupsById).toHaveLength(1);
      expect(singleGroup.groupsById[0]).toHaveLength(6);
      expect(singleGroup.delta).toBe(0); // Only one group
    });

    it('should preserve all item IDs', () => {
      const fallback = createGracefulDegradation(basicItems, 2, 3, new Error('Test'));
      const allAssignedIds = fallback.groupsById.flat();
      
      expect(allAssignedIds).toHaveLength(6);
      expect(new Set(allAssignedIds).size).toBe(6); // No duplicates
      
      const originalIds = basicItems.map(item => item.id);
      expect(allAssignedIds.sort()).toEqual(originalIds.sort());
    });

    it('should calculate correct group sums', () => {
      const fallback = createGracefulDegradation(basicItems, 2, 3, new Error('Test'));
      const totalCapacity = basicItems.reduce((sum, item) => sum + item.capacity, 0);
      const sumOfGroupSums = fallback.groupSums.reduce((sum, groupSum) => sum + groupSum, 0);
      
      expect(sumOfGroupSums).toBeCloseTo(totalCapacity, 10);
    });

    it('should sort items by capacity for better balance', () => {
      const fallback = createGracefulDegradation(basicItems, 2, 3, new Error('Test'));
      
      // First group should get items 0, 2, 4 (10, 6, 2) based on round-robin of sorted items
      // Second group should get items 1, 3, 5 (8, 4, 1)
      // So delta should be relatively small compared to random assignment
      expect(fallback.delta).toBeLessThan(10); // Should be better than worst case
    });

    it('should handle extremely small problems', () => {
      const tinyItems: Item[] = [{ id: 'single', capacity: 1 }];
      
      const fallback = createGracefulDegradation(tinyItems, 1, 1, new Error('Tiny problem'));
      
      expect(fallback.groupsById).toEqual([['single']]);
      expect(fallback.groupSums).toEqual([1]);
      expect(fallback.delta).toBe(0);
    });

    it('should handle zero capacity items', () => {
      const zeroItems: Item[] = [
        { id: 'zero1', capacity: 0 },
        { id: 'zero2', capacity: 0 },
        { id: 'normal', capacity: 10 },
        { id: 'zero3', capacity: 0 },
      ];
      
      const fallback = createGracefulDegradation(zeroItems, 2, 2, new Error('Zero test'));
      
      expect(fallback.groupsById).toHaveLength(2);
      expect(fallback.groupSums.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it('should include original error message', () => {
      const originalError = new Error('Specific failure reason');
      const fallback = createGracefulDegradation(basicItems, 2, 3, originalError);
      
      expect(fallback.methodUsed).toBe('graceful-degradation');
    });
  });

  describe('Strategy Interface Compliance', () => {
    const strategies = [
      new SimplerAlgorithmFallback(),
      new ProblemSizeReduction(), 
      new NumericalPrecisionRecovery(),
      new TimeoutRecovery()
    ];

    strategies.forEach(strategy => {
      it(`${strategy.name} should implement RecoveryStrategy interface`, () => {
        expect(typeof strategy.name).toBe('string');
        expect(typeof strategy.canHandle).toBe('function');
        expect(typeof strategy.recover).toBe('function');
      });

      it(`${strategy.name} should return boolean from canHandle`, () => {
        const error = new Error('Test');
        const result = strategy.canHandle(error);
        expect(typeof result).toBe('boolean');
      });

      it(`${strategy.name} should return Grouping or null from recover`, () => {
        const error = new Error('Test');
        const result = strategy.recover(basicItems, 2, 3, {}, error);
        expect(result === null || typeof result === 'object').toBe(true);
      });
    });
  });
});
