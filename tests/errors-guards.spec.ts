import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  AlgorithmError,
  TimeoutError,
  InfeasibleError,
  isBalancedKGroupsError,
  isValidationError,
  isAlgorithmError,
  isTimeoutError,
  isInfeasibleError,
} from '../src/errors.js';

describe('Error Type Guards', () => {
  it('isBalancedKGroupsError identifies custom errors', () => {
    const e1 = new ValidationError('v');
    const e2 = new AlgorithmError('a', 'lpt');
    const e3 = new TimeoutError('t', 1);
    const e4 = new InfeasibleError('i');
    const e5 = new Error('native');

    expect(isBalancedKGroupsError(e1)).toBe(true);
    expect(isBalancedKGroupsError(e2)).toBe(true);
    expect(isBalancedKGroupsError(e3)).toBe(true);
    expect(isBalancedKGroupsError(e4)).toBe(true);
    expect(isBalancedKGroupsError(e5)).toBe(false);
  });

  it('specific guards work', () => {
    const validation = new ValidationError('x');
    const algorithm = new AlgorithmError('y', 'roundrobin');
    const timeout = new TimeoutError('z', 5);
    const infeasible = new InfeasibleError('w');

    expect(isValidationError(validation)).toBe(true);
    expect(isValidationError(algorithm)).toBe(false);

    expect(isAlgorithmError(algorithm)).toBe(true);
    expect(isAlgorithmError(timeout)).toBe(false);

    expect(isTimeoutError(timeout)).toBe(true);
    expect(isTimeoutError(infeasible)).toBe(false);

    expect(isInfeasibleError(infeasible)).toBe(true);
    expect(isInfeasibleError(validation)).toBe(false);
  });
});
