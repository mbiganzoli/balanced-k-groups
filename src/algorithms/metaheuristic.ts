import { Item } from '../types.js';

export type MetaheuristicType =
  | 'genetic'
  | 'simulated-annealing'
  | 'tabu-search';

export interface MetaheuristicOptions {
  type: MetaheuristicType;
  maxIters?: number;
  timeLimitMs?: number;
  seed?: number;
  // Genetic Algorithm parameters
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  eliteSize?: number;
  // Simulated Annealing parameters
  initialTemperature?: number;
  coolingRate?: number;
  minTemperature?: number;
  // Tabu Search parameters
  tabuSize?: number;
  aspirationCriteria?: boolean;
}

export interface MetaheuristicResult {
  groupsByIndex: number[][];
  groupSums: number[];
  iterations: number;
  method: string;
  fitness?: number;
}

/**
 * Metaheuristic approaches for balanced partitioning including Genetic Algorithms,
 * Simulated Annealing, and Tabu Search with configurable parameters.
 */
export function metaheuristic(
  items: Item[],
  groups: number,
  groupSize: number,
  options: MetaheuristicOptions
): MetaheuristicResult {
  const {
    type,
    maxIters = 1000,
    timeLimitMs = 10000,
    seed,
    populationSize = 50,
    mutationRate = 0.1,
    crossoverRate = 0.8,
    eliteSize = 5,
    initialTemperature = 1000,
    coolingRate = 0.95,
    minTemperature = 0.1,
    tabuSize = 20,
    aspirationCriteria = true,
  } = options;

  const startTime = performance.now();
  let iterations = 0;

  // Simple LCG for deterministic randomness
  let randState = (seed ?? 123456789) >>> 0;
  const rand = (): number => {
    randState = (1664525 * randState + 1013904223) >>> 0;
    return randState / 0xffffffff;
  };

  const totalItems = items.length;
  const targetGroupSize = groupSize;
  const targetGroups = groups;

  if (totalItems !== targetGroups * targetGroupSize) {
    throw new Error('Metaheuristic requires exact group size constraints');
  }

  // Fitness function: lower delta is better
  function calculateFitness(groupsByIndex: number[][]): number {
    const groupSums: number[] = [];
    for (let g = 0; g < targetGroups; g++) {
      let sum = 0;
      for (let i = 0; i < groupsByIndex[g]!.length; i++) {
        sum += items[groupsByIndex[g]![i]!]!.capacity;
      }
      groupSums[g] = sum;
    }
    const delta = Math.max(...groupSums) - Math.min(...groupSums);
    return 1 / (1 + delta); // Higher fitness for lower delta
  }

  // Generate random solution
  function generateRandomSolution(): number[][] {
    const groupsByIndex: number[][] = [];
    for (let g = 0; g < targetGroups; g++) {
      groupsByIndex[g] = [];
    }

    const shuffledIndices = Array.from({ length: totalItems }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledIndices[i]!, shuffledIndices[j]!] = [
        shuffledIndices[j]!,
        shuffledIndices[i]!,
      ];
    }

    for (let i = 0; i < totalItems; i++) {
      const groupIndex = i % targetGroups;
      groupsByIndex[groupIndex]!.push(shuffledIndices[i]!);
    }

    return groupsByIndex;
  }

  // Genetic Algorithm
  function geneticAlgorithm(): MetaheuristicResult {
    // Initialize population
    const population: number[][][] = [];
    for (let i = 0; i < populationSize; i++) {
      population[i] = generateRandomSolution();
    }

    let bestSolution = population[0]!;
    let bestFitness = calculateFitness(bestSolution);

    for (let generation = 0; generation < maxIters; generation++) {
      iterations++;
      if (performance.now() - startTime > timeLimitMs) break;

      // Evaluate fitness for all solutions
      const fitnessScores: { solution: number[][]; fitness: number }[] = [];
      for (let i = 0; i < populationSize; i++) {
        const fitness = calculateFitness(population[i]!);
        fitnessScores.push({ solution: population[i]!, fitness });
        if (fitness > bestFitness) {
          bestFitness = fitness;
          bestSolution = population[i]!.map(g => [...g]);
        }
      }

      // Sort by fitness (descending)
      fitnessScores.sort((a, b) => b.fitness - a.fitness);

      // Create new population
      const newPopulation: number[][][] = [];

      // Elitism: keep best solutions
      for (let i = 0; i < eliteSize; i++) {
        newPopulation[i] = fitnessScores[i]!.solution.map(g => [...g]);
      }

      // Generate new solutions through crossover and mutation
      for (let i = eliteSize; i < populationSize; i++) {
        let newSolution: number[][];

        if (rand() < crossoverRate) {
          // Crossover
          const parent1 =
            fitnessScores[Math.floor(rand() * eliteSize)]!.solution;
          const parent2 =
            fitnessScores[Math.floor(rand() * eliteSize)]!.solution;
          newSolution = crossover(parent1, parent2);
        } else {
          // Copy existing solution
          newSolution = fitnessScores[
            Math.floor(rand() * populationSize)
          ]!.solution.map(g => [...g]);
        }

        // Mutation
        if (rand() < mutationRate) {
          newSolution = mutate(newSolution);
        }

        newPopulation[i] = newSolution;
      }

      // Update population
      for (let i = 0; i < populationSize; i++) {
        population[i] = newPopulation[i]!;
      }
    }

    return {
      groupsByIndex: bestSolution,
      groupSums: calculateGroupSums(bestSolution),
      iterations,
      method: 'metaheuristic-genetic',
      fitness: bestFitness,
    };
  }

  // Crossover operation for genetic algorithm
  function crossover(parent1: number[][], parent2: number[][]): number[][] {
    const child: number[][] = [];
    for (let g = 0; g < targetGroups; g++) {
      child[g] = [];
    }

    // Uniform crossover: randomly choose from each parent
    const usedItems = new Set<number>();
    for (let g = 0; g < targetGroups; g++) {
      for (let i = 0; i < targetGroupSize; i++) {
        if (rand() < 0.5) {
          const item = parent1[g]![i]!;
          if (!usedItems.has(item)) {
            child[g]!.push(item);
            usedItems.add(item);
          }
        } else {
          const item = parent2[g]![i]!;
          if (!usedItems.has(item)) {
            child[g]!.push(item);
            usedItems.add(item);
          }
        }
      }
    }

    // Fill remaining slots with unused items
    for (let i = 0; i < totalItems; i++) {
      if (!usedItems.has(i)) {
        for (let g = 0; g < targetGroups; g++) {
          if (child[g]!.length < targetGroupSize) {
            child[g]!.push(i);
            break;
          }
        }
      }
    }

    return child;
  }

  // Mutation operation for genetic algorithm
  function mutate(solution: number[][]): number[][] {
    const mutated = solution.map(g => [...g]);

    // Random swap between two groups
    const g1 = Math.floor(rand() * targetGroups);
    const g2 = Math.floor(rand() * targetGroups);
    if (g1 !== g2) {
      const i1 = Math.floor(rand() * targetGroupSize);
      const i2 = Math.floor(rand() * targetGroupSize);
      [mutated[g1]![i1]!, mutated[g2]![i2]!] = [
        mutated[g2]![i2]!,
        mutated[g1]![i1]!,
      ];
    }

    return mutated;
  }

  // Simulated Annealing
  function simulatedAnnealing(): MetaheuristicResult {
    let currentSolution = generateRandomSolution();
    let currentFitness = calculateFitness(currentSolution);
    let bestSolution = currentSolution.map(g => [...g]);
    let bestFitness = currentFitness;
    let temperature = initialTemperature;

    for (let iteration = 0; iteration < maxIters; iteration++) {
      iterations++;
      if (performance.now() - startTime > timeLimitMs) break;

      // Generate neighbor solution
      const neighbor = generateNeighbor(currentSolution);
      const neighborFitness = calculateFitness(neighbor);

      // Accept or reject based on temperature and fitness difference
      const deltaFitness = neighborFitness - currentFitness;
      if (deltaFitness > 0 || rand() < Math.exp(deltaFitness / temperature)) {
        currentSolution = neighbor;
        currentFitness = neighborFitness;

        if (currentFitness > bestFitness) {
          bestFitness = currentFitness;
          bestSolution = currentSolution.map(g => [...g]);
        }
      }

      // Cool down
      temperature *= coolingRate;
      if (temperature < minTemperature) {
        temperature = minTemperature;
      }
    }

    return {
      groupsByIndex: bestSolution,
      groupSums: calculateGroupSums(bestSolution),
      iterations,
      method: 'metaheuristic-simulated-annealing',
      fitness: bestFitness,
    };
  }

  // Tabu Search
  function tabuSearch(): MetaheuristicResult {
    let currentSolution = generateRandomSolution();
    let currentFitness = calculateFitness(currentSolution);
    let bestSolution = currentSolution.map(g => [...g]);
    let bestFitness = currentFitness;
    const tabuList: Set<string> = new Set();

    for (let iteration = 0; iteration < maxIters; iteration++) {
      iterations++;
      if (performance.now() - startTime > timeLimitMs) break;

      let bestNeighbor: number[][] | null = null;
      let bestNeighborFitness = -Infinity;
      let bestMove = '';

      // Generate all possible neighbors
      for (let g1 = 0; g1 < targetGroups; g1++) {
        for (let g2 = g1 + 1; g2 < targetGroups; g2++) {
          for (let i1 = 0; i1 < targetGroupSize; i1++) {
            for (let i2 = 0; i2 < targetGroupSize; i2++) {
              const neighbor = generateSwapNeighbor(
                currentSolution,
                g1,
                i1,
                g2,
                i2
              );
              const neighborFitness = calculateFitness(neighbor);
              const move = `${g1}-${i1}-${g2}-${i2}`;

              // Check if move is not tabu or satisfies aspiration criteria
              if (
                !tabuList.has(move) ||
                (aspirationCriteria && neighborFitness > bestFitness)
              ) {
                if (neighborFitness > bestNeighborFitness) {
                  bestNeighbor = neighbor;
                  bestNeighborFitness = neighborFitness;
                  bestMove = move;
                }
              }
            }
          }
        }
      }

      if (bestNeighbor) {
        currentSolution = bestNeighbor;
        currentFitness = bestNeighborFitness;

        if (currentFitness > bestFitness) {
          bestFitness = currentFitness;
          bestSolution = currentSolution.map(g => [...g]);
        }

        // Add move to tabu list
        tabuList.add(bestMove);
        if (tabuList.size > tabuSize) {
          const firstMove = tabuList.values().next().value as
            | string
            | undefined;
          if (firstMove !== undefined) {
            tabuList.delete(firstMove);
          }
        }
      }
    }

    return {
      groupsByIndex: bestSolution,
      groupSums: calculateGroupSums(bestSolution),
      iterations,
      method: 'metaheuristic-tabu-search',
      fitness: bestFitness,
    };
  }

  // Helper functions
  function generateNeighbor(solution: number[][]): number[][] {
    const neighbor = solution.map(g => [...g]);
    const g1 = Math.floor(rand() * targetGroups);
    const g2 = Math.floor(rand() * targetGroups);
    if (g1 !== g2) {
      const i1 = Math.floor(rand() * targetGroupSize);
      const i2 = Math.floor(rand() * targetGroupSize);
      [neighbor[g1]![i1]!, neighbor[g2]![i2]!] = [
        neighbor[g2]![i2]!,
        neighbor[g1]![i1]!,
      ];
    }
    return neighbor;
  }

  function generateSwapNeighbor(
    solution: number[][],
    g1: number,
    i1: number,
    g2: number,
    i2: number
  ): number[][] {
    const neighbor = solution.map(g => [...g]);
    [neighbor[g1]![i1]!, neighbor[g2]![i2]!] = [
      neighbor[g2]![i2]!,
      neighbor[g1]![i1]!,
    ];
    return neighbor;
  }

  function calculateGroupSums(groupsByIndex: number[][]): number[] {
    const groupSums: number[] = [];
    for (let g = 0; g < targetGroups; g++) {
      let sum = 0;
      for (let i = 0; i < groupsByIndex[g]!.length; i++) {
        sum += items[groupsByIndex[g]![i]!]!.capacity;
      }
      groupSums[g] = sum;
    }
    return groupSums;
  }

  // Execute selected metaheuristic
  switch (type) {
    case 'genetic':
      return geneticAlgorithm();
    case 'simulated-annealing':
      return simulatedAnnealing();
    case 'tabu-search':
      return tabuSearch();
    default: {
      const t: string = String(type);
      throw new Error(`Unknown metaheuristic type: ${t}`);
    }
  }
}
