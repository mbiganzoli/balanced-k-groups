import { Item } from '../types.js';

export type SwapStrategy = 'best' | 'stochastic';

export interface LocalRefineOptions {
  maxIters?: number;
  strategy?: SwapStrategy;
  enable11?: boolean;
  enable12?: boolean; // Declared but skipped when strict group sizes are required
  enable22?: boolean;
  seed?: number; // Used for stochastic strategy
}

export interface LocalRefineResult {
  groupsByIndex: number[][];
  groupSums: number[];
  iterations: number;
  improvements: number;
}

/**
 * Local refinement of an existing grouping using swap operations preserving exact group sizes.
 * Currently supports 1↔1 and 2↔2 swaps. 1↔2 swaps are skipped under strict group-size constraints.
 */
export function localRefine(
  items: Item[],
  groupsByIndex: number[][],
  options: LocalRefineOptions = {}
): LocalRefineResult {
  const {
    maxIters = 200,
    strategy = 'best',
    enable11 = true,
    enable12 = false, // Skipped under strict size constraints
    enable22 = true,
    seed,
  } = options;

  const groups = groupsByIndex.length;
  const groupSize = groupsByIndex[0]?.length ?? 0;
  // Ensure all groups have same size
  for (let g = 1; g < groups; g++) {
    if ((groupsByIndex[g]?.length ?? 0) !== groupSize) {
      throw new Error('localRefine requires equal-sized groups');
    }
  }

  const groupSums: number[] = new Array(groups);
  for (let g = 0; g < groups; g++) {
    let s = 0;
    for (let i = 0; i < groupsByIndex[g]!.length; i++) {
      s += items[groupsByIndex[g]![i]!]!.capacity;
    }
    groupSums[g] = s;
  }

  let iterations = 0;
  let improvements = 0;

  // Simple LCG for deterministic randomness
  let randState = (seed ?? 123456789) >>> 0;
  const rand = (): number => {
    randState = (1664525 * randState + 1013904223) >>> 0;
    return randState / 0xffffffff;
  };

  const getDelta = (): number =>
    Math.max(...groupSums) - Math.min(...groupSums);

  function apply11IfBetter(
    g1: number,
    i1: number,
    g2: number,
    i2: number
  ): boolean {
    const idx1 = groupsByIndex[g1]![i1]!;
    const idx2 = groupsByIndex[g2]![i2]!;
    const cap1 = items[idx1]!.capacity;
    const cap2 = items[idx2]!.capacity;
    const currentDelta = getDelta();
    const newSum1 = groupSums[g1]! - cap1 + cap2;
    const newSum2 = groupSums[g2]! - cap2 + cap1;
    const maxOther = Math.max(
      ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
    );
    const minOther = Math.min(
      ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
    );
    const newDelta =
      Math.max(maxOther, newSum1, newSum2) -
      Math.min(minOther, newSum1, newSum2);
    if (newDelta < currentDelta) {
      groupsByIndex[g1]![i1] = idx2;
      groupsByIndex[g2]![i2] = idx1;
      groupSums[g1] = newSum1;
      groupSums[g2] = newSum2;
      return true;
    }
    return false;
  }

  function apply22IfBetter(
    g1: number,
    i1a: number,
    i1b: number,
    g2: number,
    i2a: number,
    i2b: number
  ): boolean {
    const idx1a = groupsByIndex[g1]![i1a]!;
    const idx1b = groupsByIndex[g1]![i1b]!;
    const idx2a = groupsByIndex[g2]![i2a]!;
    const idx2b = groupsByIndex[g2]![i2b]!;
    const c1a = items[idx1a]!.capacity;
    const c1b = items[idx1b]!.capacity;
    const c2a = items[idx2a]!.capacity;
    const c2b = items[idx2b]!.capacity;
    const currentDelta = getDelta();
    const newSum1 = groupSums[g1]! - c1a - c1b + c2a + c2b;
    const newSum2 = groupSums[g2]! - c2a - c2b + c1a + c1b;
    const maxOther = Math.max(
      ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
    );
    const minOther = Math.min(
      ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
    );
    const newDelta =
      Math.max(maxOther, newSum1, newSum2) -
      Math.min(minOther, newSum1, newSum2);
    if (newDelta < currentDelta) {
      groupsByIndex[g1]![i1a] = idx2a;
      groupsByIndex[g1]![i1b] = idx2b;
      groupsByIndex[g2]![i2a] = idx1a;
      groupsByIndex[g2]![i2b] = idx1b;
      groupSums[g1] = newSum1;
      groupSums[g2] = newSum2;
      return true;
    }
    return false;
  }

  function iterateBest(): boolean {
    let bestMove: (() => void) | null = null;
    let bestDelta = getDelta();

    if (enable11) {
      for (let g1 = 0; g1 < groups; g1++) {
        for (let g2 = g1 + 1; g2 < groups; g2++) {
          for (let i1 = 0; i1 < groupSize; i1++) {
            for (let i2 = 0; i2 < groupSize; i2++) {
              const idx1 = groupsByIndex[g1]![i1]!;
              const idx2 = groupsByIndex[g2]![i2]!;
              const c1 = items[idx1]!.capacity;
              const c2 = items[idx2]!.capacity;
              const newSum1 = groupSums[g1]! - c1 + c2;
              const newSum2 = groupSums[g2]! - c2 + c1;
              const maxOther = Math.max(
                ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
              );
              const minOther = Math.min(
                ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
              );
              const newDelta =
                Math.max(maxOther, newSum1, newSum2) -
                Math.min(minOther, newSum1, newSum2);
              if (newDelta < bestDelta) {
                bestDelta = newDelta;
                bestMove = (() => {
                  groupsByIndex[g1]![i1] = idx2;
                  groupsByIndex[g2]![i2] = idx1;
                  groupSums[g1] = newSum1;
                  groupSums[g2] = newSum2;
                }) as () => void;
              }
            }
          }
        }
      }
    }

    if (enable22) {
      for (let g1 = 0; g1 < groups; g1++) {
        for (let g2 = g1 + 1; g2 < groups; g2++) {
          for (let i1a = 0; i1a < groupSize; i1a++) {
            for (let i1b = i1a + 1; i1b < groupSize; i1b++) {
              for (let i2a = 0; i2a < groupSize; i2a++) {
                for (let i2b = i2a + 1; i2b < groupSize; i2b++) {
                  const idx1a = groupsByIndex[g1]![i1a]!;
                  const idx1b = groupsByIndex[g1]![i1b]!;
                  const idx2a = groupsByIndex[g2]![i2a]!;
                  const idx2b = groupsByIndex[g2]![i2b]!;
                  const c1a = items[idx1a]!.capacity;
                  const c1b = items[idx1b]!.capacity;
                  const c2a = items[idx2a]!.capacity;
                  const c2b = items[idx2b]!.capacity;
                  const newSum1 = groupSums[g1]! - c1a - c1b + c2a + c2b;
                  const newSum2 = groupSums[g2]! - c2a - c2b + c1a + c1b;
                  const maxOther = Math.max(
                    ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
                  );
                  const minOther = Math.min(
                    ...groupSums.filter((_, gg) => gg !== g1 && gg !== g2)
                  );
                  const newDelta =
                    Math.max(maxOther, newSum1, newSum2) -
                    Math.min(minOther, newSum1, newSum2);
                  if (newDelta < bestDelta) {
                    bestDelta = newDelta;
                    bestMove = (() => {
                      groupsByIndex[g1]![i1a] = idx2a;
                      groupsByIndex[g1]![i1b] = idx2b;
                      groupsByIndex[g2]![i2a] = idx1a;
                      groupsByIndex[g2]![i2b] = idx1b;
                      groupSums[g1] = newSum1;
                      groupSums[g2] = newSum2;
                    }) as () => void;
                  }
                }
              }
            }
          }
        }
      }
    }

    // 1↔2 swaps skipped due to strict size constraint
    void enable12;

    if (bestMove) {
      bestMove();
      improvements++;
      return true;
    }
    return false;
  }

  function iterateStochastic(): boolean {
    const attempts = Math.max(100, groups * groupSize * 2);

    if (enable11) {
      for (let t = 0; t < attempts; t++) {
        const g1 = Math.floor(rand() * groups);
        let g2 = Math.floor(rand() * groups);
        if (g2 === g1) g2 = (g2 + 1) % groups;
        const i1 = Math.floor(rand() * groupSize);
        const i2 = Math.floor(rand() * groupSize);
        if (apply11IfBetter(g1, i1, g2, i2)) {
          improvements++;
          return true;
        }
      }
    }

    if (enable22) {
      for (let t = 0; t < attempts; t++) {
        const g1 = Math.floor(rand() * groups);
        let g2 = Math.floor(rand() * groups);
        if (g2 === g1) g2 = (g2 + 1) % groups;
        const i1a = Math.floor(rand() * groupSize);
        let i1b = Math.floor(rand() * groupSize);
        if (i1b === i1a) i1b = (i1b + 1) % groupSize;
        const i2a = Math.floor(rand() * groupSize);
        let i2b = Math.floor(rand() * groupSize);
        if (i2b === i2a) i2b = (i2b + 1) % groupSize;
        if (apply22IfBetter(g1, i1a, i1b, g2, i2a, i2b)) {
          improvements++;
          return true;
        }
      }
    }

    // 1↔2 swaps skipped due to strict size constraint

    return false;
  }

  let improved = true;
  while (improved && iterations < maxIters) {
    iterations++;
    improved = strategy === 'best' ? iterateBest() : iterateStochastic();
  }

  return {
    groupsByIndex,
    groupSums,
    iterations,
    improvements,
  };
}
