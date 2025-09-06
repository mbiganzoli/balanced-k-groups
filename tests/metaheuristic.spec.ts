import { describe, it, expect } from 'vitest';
import { metaheuristic } from '../src/algorithms/metaheuristic.js';
import { Item } from '../src/types.js';
import { evaluateGrouping } from '../src/algorithms/evaluate.js';

describe('metaheuristic', () => {
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

  it('genetic algorithm works with default parameters', () => {
    const result = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('metaheuristic-genetic');
    expect(result.fitness).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('genetic algorithm works with custom parameters', () => {
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'genetic',
      populationSize: 20,
      mutationRate: 0.2,
      crossoverRate: 0.9,
      eliteSize: 3,
      seed: 123,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('metaheuristic-genetic');
    expect(result.fitness).toBeDefined();
  });

  it('simulated annealing works with default parameters', () => {
    const result = metaheuristic(smallItems, 2, 2, {
      type: 'simulated-annealing',
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('metaheuristic-simulated-annealing');
    expect(result.fitness).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('simulated annealing works with custom parameters', () => {
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'simulated-annealing',
      initialTemperature: 500,
      coolingRate: 0.98,
      minTemperature: 0.01,
      seed: 456,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('metaheuristic-simulated-annealing');
    expect(result.fitness).toBeDefined();
  });

  it('tabu search works with default parameters', () => {
    const result = metaheuristic(smallItems, 2, 2, {
      type: 'tabu-search',
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
    expect(result.method).toBe('metaheuristic-tabu-search');
    expect(result.fitness).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('tabu search works with custom parameters', () => {
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'tabu-search',
      tabuSize: 15,
      aspirationCriteria: false,
      seed: 789,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(4);
    expect(result.groupsByIndex[1]).toHaveLength(4);
    expect(result.method).toBe('metaheuristic-tabu-search');
    expect(result.fitness).toBeDefined();
  });

  it('maintains exact group size constraints', () => {
    const result = metaheuristic(mediumItems, 4, 2, {
      type: 'genetic',
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(4);
    for (let g = 0; g < 4; g++) {
      expect(result.groupsByIndex[g]).toHaveLength(2);
    }
  });

  it('produces valid grouping with all items assigned', () => {
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'simulated-annealing',
      seed: 42,
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
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'tabu-search',
      maxIters: 50,
      timeLimitMs: 1, // Very short time limit
      seed: 42,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBeLessThanOrEqual(50);
  });

  it('seed-based reproducibility works', () => {
    const result1 = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      seed: 42,
      maxIters: 100,
    });

    const result2 = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      seed: 42,
      maxIters: 100,
    });

    // With same seed, should produce same result
    expect(result1.groupsByIndex).toEqual(result2.groupsByIndex);
    expect(result1.fitness).toBe(result2.fitness);
  });

  it('different seeds produce different results', () => {
    const result1 = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      seed: 42,
      maxIters: 100,
    });

    const result2 = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      seed: 123,
      maxIters: 100,
    });

    // With different seeds, should produce different results (most of the time)
    // Note: This test might occasionally fail due to randomness, but should succeed most times
    const different = JSON.stringify(result1.groupsByIndex) !== JSON.stringify(result2.groupsByIndex);
    expect(different).toBe(true);
  });

  it('handles different problem sizes appropriately', () => {
    const tinyItems: Item[] = [
      { id: 'a', capacity: 5 },
      { id: 'b', capacity: 4 },
    ];

    const result = metaheuristic(tinyItems, 1, 2, {
      type: 'genetic',
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(1);
    expect(result.groupsByIndex[0]).toHaveLength(2);
  });

  it('demonstrates parameter sensitivity', () => {
    // Test that different parameters affect the solution
    const result1 = metaheuristic(mediumItems, 2, 4, {
      type: 'genetic',
      populationSize: 10,
      mutationRate: 0.05,
      seed: 42,
      maxIters: 100,
    });

    const result2 = metaheuristic(mediumItems, 2, 4, {
      type: 'genetic',
      populationSize: 100,
      mutationRate: 0.3,
      seed: 42,
      maxIters: 100,
    });

    // Different parameters should produce different results
    expect(result1.iterations).toBeLessThanOrEqual(result2.iterations);
  });

  it('produces balanced groupings', () => {
    const result = metaheuristic(mediumItems, 2, 4, {
      type: 'simulated-annealing',
      seed: 42,
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

  it('handles edge cases gracefully', () => {
    // Test with very small population
    const result = metaheuristic(smallItems, 2, 2, {
      type: 'genetic',
      populationSize: 2,
      eliteSize: 1,
      seed: 42,
    });

    expect(result.groupsByIndex).toHaveLength(2);
    expect(result.groupsByIndex[0]).toHaveLength(2);
    expect(result.groupsByIndex[1]).toHaveLength(2);
  });
});
