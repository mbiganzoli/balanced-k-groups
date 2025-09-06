import { describe, it, expect } from 'vitest';
import { 
  assertUniqueIds, 
  isFeasible,
  validatePartitionInputs,
  validatePartitionOptions,
  validateCapacities,
  validateGroupParameters,
  ensureInputImmutability
} from '../src/validation.js';
import { 
  ValidationError,
  AlgorithmError,
  TimeoutError,
  InfeasibleError,
  ConfigurationError,
  NumericalError,
  MemoryError,
  UnsupportedError,
  createValidationError,
  createAlgorithmError,
  createTimeoutError
} from '../src/errors.js';
import { Item } from '../src/types.js';
import { partitionBalanced } from '../src/index.js';

describe('Validation Functions', () => {
  describe('assertUniqueIds', () => {
    it('should pass with unique IDs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
      ];
      
      expect(() => assertUniqueIds(items)).not.toThrow();
    });

    it('should throw ValidationError for duplicate IDs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'a', capacity: 6 }, // Duplicate
      ];
      
      expect(() => assertUniqueIds(items)).toThrow(ValidationError);
      expect(() => assertUniqueIds(items)).toThrow('Duplicate item IDs found: a');
    });

    it('should handle numeric IDs', () => {
      const items: Item[] = [
        { id: 1, capacity: 10 },
        { id: 2, capacity: 8 },
        { id: 1, capacity: 6 }, // Duplicate
      ];
      
      expect(() => assertUniqueIds(items)).toThrow(ValidationError);
    });

    it('should handle mixed ID types', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 1, capacity: 8 },
        { id: 'a', capacity: 6 }, // Duplicate string
      ];
      
      expect(() => assertUniqueIds(items)).toThrow(ValidationError);
    });

    it('should handle empty array', () => {
      expect(() => assertUniqueIds([])).not.toThrow();
    });
  });

  describe('validateCapacities', () => {
    it('should pass with valid positive capacities', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10.5 },
        { id: 'b', capacity: 0.1 },
        { id: 'c', capacity: 1000 },
      ];
      
      expect(() => validateCapacities(items)).not.toThrow();
    });

    it('should throw for invalid array input', () => {
      const invalidArrays = [
        [{ id: 'a', capacity: 10 }, { id: 'b', capacity: 0 }], // Zero capacity
        [{ id: 'a', capacity: 10 }, { id: 'b', capacity: -5 }], // Negative capacity
        [{ id: 'a', capacity: 10 }, { id: 'b', capacity: NaN }], // NaN capacity
        [{ id: 'a', capacity: 10 }, { id: 'b', capacity: Infinity }], // Infinite capacity
        [{ id: 'a', capacity: 10 }, { id: 'b', capacity: 'invalid' }], // String instead of number
      ];

      invalidArrays.forEach(items => {
        expect(() => validateCapacities(items as any)).toThrow(ValidationError);
        expect(() => validateCapacities(items as any)).toThrow('Invalid items: expected array of valid Item objects');
      });
    });

    it('should throw for empty array type validation', () => {
      expect(() => validateCapacities(null as any)).toThrow(ValidationError);
      expect(() => validateCapacities('not an array' as any)).toThrow(ValidationError);
      expect(() => validateCapacities(undefined as any)).toThrow(ValidationError);
    });

    it('should properly validate through partitionBalanced integration', () => {
      // Test the actual validation through the main function
      const itemsWithZero = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 0 }, // Zero capacity
      ];
      
      expect(() => partitionBalanced(itemsWithZero as any, 1, 2)).toThrow();
      
      const itemsWithNaN = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: NaN }, // NaN capacity
      ];
      
      expect(() => partitionBalanced(itemsWithNaN as any, 1, 2)).toThrow();
    });
  });

  describe('validateGroupParameters', () => {
    it('should pass with valid positive integers', () => {
      expect(() => validateGroupParameters(3, 5)).not.toThrow();
      expect(() => validateGroupParameters(1, 1)).not.toThrow();
      expect(() => validateGroupParameters(100, 10)).not.toThrow();
    });

    it('should throw for zero groups', () => {
      expect(() => validateGroupParameters(0, 5)).toThrow(ValidationError);
      expect(() => validateGroupParameters(0, 5)).toThrow('positive integer');
    });

    it('should throw for negative groups', () => {
      expect(() => validateGroupParameters(-2, 5)).toThrow(ValidationError);
    });

    it('should throw for zero groupSize', () => {
      expect(() => validateGroupParameters(3, 0)).toThrow(ValidationError);
    });

    it('should throw for decimal groups', () => {
      expect(() => validateGroupParameters(2.5, 5)).toThrow(ValidationError);
    });

    it('should throw for decimal groupSize', () => {
      expect(() => validateGroupParameters(3, 4.2)).toThrow(ValidationError);
    });

    it('should throw for too many groups', () => {
      expect(() => validateGroupParameters(1001, 5)).toThrow(ValidationError);
      expect(() => validateGroupParameters(1001, 5)).toThrow('too many groups');
    });

    it('should throw for too large groupSize', () => {
      expect(() => validateGroupParameters(3, 1001)).toThrow(ValidationError);
      expect(() => validateGroupParameters(3, 1001)).toThrow('too large group size');
    });

    it('should throw for non-number inputs', () => {
      expect(() => validateGroupParameters('3' as any, 5)).toThrow(ValidationError);
      expect(() => validateGroupParameters(3, '5' as any)).toThrow(ValidationError);
    });
  });

  describe('validatePartitionOptions', () => {
    it('should pass with valid options', () => {
      const validOptions = {
        method: 'lpt',
        timeLimitMs: 5000,
        seed: 42,
        maxIters: 100,
        tolerance: 1e-6,
        earlyStopDelta: 0.1,
        returnIntermediate: true
      };
      
      expect(() => validatePartitionOptions(validOptions)).not.toThrow();
    });

    it('should pass with empty options', () => {
      expect(() => validatePartitionOptions({})).not.toThrow();
    });

    it('should throw for invalid method', () => {
      const options = { method: 'invalid-method' };
      expect(() => validatePartitionOptions(options)).toThrow(ValidationError);
      expect(() => validatePartitionOptions(options)).toThrow('one of:');
    });

    it('should throw for invalid scale', () => {
      const options = { scale: -1 };
      expect(() => validatePartitionOptions(options)).toThrow(ValidationError);
      expect(() => validatePartitionOptions(options)).toThrow('positive finite number');
    });

    it('should throw for negative timeLimitMs', () => {
      const options = { timeLimitMs: -100 };
      expect(() => validatePartitionOptions(options)).toThrow(ValidationError);
    });

    it('should throw for invalid returnIntermediate', () => {
      const options = { returnIntermediate: 'true' as any };
      expect(() => validatePartitionOptions(options)).toThrow(ValidationError);
      expect(() => validatePartitionOptions(options)).toThrow('boolean');
    });

    it('should throw for non-object input', () => {
      expect(() => validatePartitionOptions('invalid' as any)).toThrow(ValidationError);
      expect(() => validatePartitionOptions(null as any)).toThrow(ValidationError);
    });
  });

  describe('isFeasible', () => {
    it('should return true for valid inputs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];
      
      expect(isFeasible(items, 2, 2)).toBe(true);
    });

    it('should return false for mismatched count', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
        { id: 'c', capacity: 6 },
      ];
      
      expect(isFeasible(items, 2, 2)).toBe(false); // Need 4 items, have 3
    });

    it('should return false for duplicate IDs', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'a', capacity: 8 }, // Duplicate
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];
      
      expect(isFeasible(items, 2, 2)).toBe(false);
    });

    it('should return false for invalid capacities', () => {
      const items: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: -8 }, // Negative
        { id: 'c', capacity: 6 },
        { id: 'd', capacity: 4 },
      ];
      
      expect(isFeasible(items, 2, 2)).toBe(false);
    });
  });

  describe('ensureInputImmutability', () => {
    it('should create deep copy of items', () => {
      const originalItems: Item[] = [
        { id: 'a', capacity: 10 },
        { id: 'b', capacity: 8 },
      ];
      
      const copiedItems = ensureInputImmutability(originalItems);
      
      // Modify original
      originalItems[0]!.capacity = 999;
      originalItems[0]!.id = 'modified';
      
      // Copy should be unchanged
      expect(copiedItems[0]!.capacity).toBe(10);
      expect(copiedItems[0]!.id).toBe('a');
      expect(copiedItems).not.toBe(originalItems);
    });

    it('should handle empty array', () => {
      const result = ensureInputImmutability([]);
      expect(result).toEqual([]);
    });
  });

  describe('validatePartitionInputs - Integration', () => {
    it('should throw InfeasibleError for zero total capacity', () => {
      const items: Item[] = [
        { id: 'a', capacity: 0 },
        { id: 'b', capacity: 0 },
      ];
      
      // This should fail capacity validation before reaching total capacity check
      expect(() => validatePartitionInputs(items, 1, 2)).toThrow(ValidationError);
    });

    it('should throw ValidationError for extreme capacity range', () => {
      const items: Item[] = [
        { id: 'a', capacity: 1e-10 },
        { id: 'b', capacity: 1e10 },
        { id: 'c', capacity: 1e15 },
        { id: 'd', capacity: 1e-15 },
      ];
      
      expect(() => validatePartitionInputs(items, 2, 2)).toThrow(ValidationError);
      expect(() => validatePartitionInputs(items, 2, 2)).toThrow('numerical precision');
    });

    it('should handle valid edge case', () => {
      const items: Item[] = [
        { id: 'a', capacity: 0.0001 },
        { id: 'b', capacity: 0.0002 },
      ];
      
      expect(() => validatePartitionInputs(items, 1, 2)).not.toThrow();
    });
  });
});

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with message and context', () => {
      const error = new ValidationError('Test message', { field: 'test', value: 123 });
      
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toEqual({ field: 'test', value: 123 });
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AlgorithmError', () => {
    it('should create error with algorithm info', () => {
      const error = new AlgorithmError('Algorithm failed', 'lpt', { iterations: 5 });
      
      expect(error.message).toBe('Algorithm failed');
      expect(error.algorithm).toBe('lpt');
      expect(error.code).toBe('ALGORITHM_ERROR');
      expect(error.context).toEqual({ iterations: 5, algorithm: 'lpt' });
    });
  });

  describe('TimeoutError', () => {
    it('should create error with timeout info', () => {
      const error = new TimeoutError('Operation timed out', 5000, { operation: 'partition' });
      
      expect(error.message).toBe('Operation timed out');
      expect(error.timeoutMs).toBe(5000);
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.context).toEqual({ operation: 'partition', timeoutMs: 5000 });
    });
  });

  describe('Error Creation Utilities', () => {
    it('should create validation error with correct format', () => {
      const error = createValidationError('capacity', -5, 'positive number', 'must be greater than 0');
      
      expect(error.message).toBe('Invalid capacity: expected positive number, must be greater than 0');
      expect(error.context).toEqual({ field: 'capacity', value: -5, expected: 'positive number' });
    });

    it('should create algorithm error with context', () => {
      const error = createAlgorithmError('lpt', 'refinement', 'no improvement found', { iterations: 10 });
      
      expect(error.message).toBe("Algorithm 'lpt' failed during refinement: no improvement found");
      expect(error.algorithm).toBe('lpt');
      expect(error.context).toEqual({ 
        operation: 'refinement', 
        reason: 'no improvement found', 
        iterations: 10, 
        algorithm: 'lpt' 
      });
    });

    it('should create timeout error with operation context', () => {
      const error = createTimeoutError('optimization', 10000, { algorithm: 'dp' });
      
      expect(error.message).toBe("Operation 'optimization' timed out after 10000ms");
      expect(error.timeoutMs).toBe(10000);
      expect(error.context).toEqual({ operation: 'optimization', algorithm: 'dp', timeoutMs: 10000 });
    });
  });

  describe('Other Error Types', () => {
    it('should create InfeasibleError', () => {
      const error = new InfeasibleError('Problem cannot be solved');
      expect(error.code).toBe('INFEASIBLE_ERROR');
      expect(error.message).toBe('Problem cannot be solved');
    });

    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('Invalid configuration');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });

    it('should create NumericalError', () => {
      const error = new NumericalError('Numerical instability detected');
      expect(error.code).toBe('NUMERICAL_ERROR');
    });

    it('should create MemoryError', () => {
      const error = new MemoryError('Out of memory', 1000000);
      expect(error.code).toBe('MEMORY_ERROR');
      expect(error.memoryUsageBytes).toBe(1000000);
    });

    it('should create UnsupportedError', () => {
      const error = new UnsupportedError('Feature not supported');
      expect(error.code).toBe('UNSUPPORTED_ERROR');
    });
  });

  describe('Error Stack Traces', () => {
    it('should maintain proper stack traces', () => {
      try {
        throw new ValidationError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.stack).toContain('ValidationError');
        expect(error.stack).toContain('validation.spec.ts');
      }
    });
  });
});
