import { Item, Grouping } from '../types.js';
import { createAlgorithmError } from '../errors.js';

interface PartitionSet {
  indices: number[];
  sum: number;
}

/**
 * Greedy 2-bin split used as a building block (LPT-like for 2 bins)
 */
function splitIntoTwo(items: Item[], indices: number[]): [number[], number[]] {
  const sorted = [...indices].sort(
    (a, b) => items[b]!.capacity - items[a]!.capacity
  );
  const left: number[] = [];
  const right: number[] = [];
  let sumL = 0;
  let sumR = 0;
  for (const idx of sorted) {
    const c = items[idx]!.capacity;
    if (sumL <= sumR) {
      left.push(idx);
      sumL += c;
    } else {
      right.push(idx);
      sumR += c;
    }
  }
  return [left, right];
}

/**
 * Repair groups to ensure each has exactly groupSize elements while keeping sums balanced
 */
function repairToExactSizes(
  items: Item[],
  groupsByIndex: number[][],
  groupSize: number,
  maxIters: number = 500
): void {
  const groups = groupsByIndex.length;
  const sums = new Array<number>(groups).fill(0);
  for (let g = 0; g < groups; g++) {
    sums[g] = groupsByIndex[g]!.reduce(
      (acc, idx) => acc + items[idx]!.capacity,
      0
    );
  }

  let iter = 0;
  while (iter < maxIters) {
    iter++;
    let donor = -1;
    let receiver = -1;
    for (let g = 0; g < groups; g++) {
      if (groupsByIndex[g]!.length > groupSize && donor === -1) donor = g;
      if (groupsByIndex[g]!.length < groupSize && receiver === -1) receiver = g;
    }
    if (donor === -1 || receiver === -1) break; // sizes satisfied

    // Choose the donor item that best reduces delta when moved to receiver
    const currentDelta = Math.max(...sums) - Math.min(...sums);
    let bestIdxInDonor = -1;
    let bestDelta = currentDelta;

    for (let i = 0; i < groupsByIndex[donor]!.length; i++) {
      const idx = groupsByIndex[donor]![i]!;
      const cap = items[idx]!.capacity;
      const newSumDonor = sums[donor]! - cap;
      const newSumReceiver = sums[receiver]! + cap;
      const temp = [...sums];
      temp[donor] = newSumDonor;
      temp[receiver] = newSumReceiver;
      const d = Math.max(...temp) - Math.min(...temp);
      if (d <= bestDelta) {
        bestDelta = d;
        bestIdxInDonor = i;
      }
    }

    // If no improvement, just move the last item to meet size constraint
    const moveIdx =
      bestIdxInDonor >= 0 ? bestIdxInDonor : groupsByIndex[donor]!.length - 1;
    const itemIdx = groupsByIndex[donor]![moveIdx]!;
    const cap = items[itemIdx]!.capacity;
    groupsByIndex[donor]!.splice(moveIdx, 1);
    groupsByIndex[receiver]!.push(itemIdx);
    sums[donor] = sums[donor]! - cap;
    sums[receiver] = sums[receiver]! + cap;
  }
}

/**
 * Local 1↔1 swap optimization (preserves exact group sizes)
 */
function localOptimizeOneOne(
  items: Item[],
  groupsByIndex: number[][],
  maxLocalIters: number = 200
): number {
  const groups = groupsByIndex.length;
  let iters = 0;
  let improved = true;

  function computeSums(): number[] {
    return groupsByIndex.map(g =>
      g.reduce((acc, idx) => acc + items[idx]!.capacity, 0)
    );
  }

  let sums = computeSums();

  while (improved && iters < maxLocalIters) {
    improved = false;
    iters++;
    const currentDelta = Math.max(...sums) - Math.min(...sums);

    for (let g1 = 0; g1 < groups; g1++) {
      for (let g2 = g1 + 1; g2 < groups; g2++) {
        for (let i1 = 0; i1 < groupsByIndex[g1]!.length; i1++) {
          for (let i2 = 0; i2 < groupsByIndex[g2]!.length; i2++) {
            const idx1 = groupsByIndex[g1]![i1]!;
            const idx2 = groupsByIndex[g2]![i2]!;
            const cap1 = items[idx1]!.capacity;
            const cap2 = items[idx2]!.capacity;

            const newSum1 = sums[g1]! - cap1 + cap2;
            const newSum2 = sums[g2]! - cap2 + cap1;
            const temp = [...sums];
            temp[g1] = newSum1;
            temp[g2] = newSum2;
            const newDelta = Math.max(...temp) - Math.min(...temp);
            if (newDelta < currentDelta) {
              // apply swap
              groupsByIndex[g1]![i1] = idx2;
              groupsByIndex[g2]![i2] = idx1;
              sums = temp;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }
  }

  return iters;
}

/**
 * KK-inspired k-way partition: build k partitions via recursive 2-way splits, then repair sizes
 */
export function kk(
  items: Item[],
  groups: number,
  groupSize: number,
  options: { maxRepairIters?: number; maxLocalIters?: number } = {}
): Grouping {
  const startTime = performance.now();
  const { maxRepairIters = 1000, maxLocalIters = 300 } = options;

  try {
    // Build initial set with all indices
    const allIndices = items.map((_, i) => i);
    const initial: PartitionSet = {
      indices: allIndices,
      sum: items.reduce((acc, it) => acc + it.capacity, 0),
    };

    // Priority of sets to split: always split the largest-sum set next
    const partitions: PartitionSet[] = [initial];

    while (partitions.length < groups) {
      // Pick the set with largest sum to split
      partitions.sort((a, b) => b.sum - a.sum);
      const top = partitions.shift()!;
      if (!top || top.indices.length <= 1) {
        // Cannot split further meaningfully; break to avoid infinite loop
        break;
      }
      const [left, right] = splitIntoTwo(items, top.indices);
      const sumL = left.reduce((acc, idx) => acc + items[idx]!.capacity, 0);
      const sumR = right.reduce((acc, idx) => acc + items[idx]!.capacity, 0);
      partitions.push({ indices: left, sum: sumL });
      partitions.push({ indices: right, sum: sumR });
    }

    // If we have more than needed due to degeneracy, merge smallest sets until exactly groups
    while (partitions.length > groups) {
      partitions.sort((a, b) => a.sum - b.sum);
      const a = partitions.shift()!;
      const b = partitions.shift()!;
      const merged = {
        indices: a.indices.concat(b.indices),
        sum: a.sum + b.sum,
      };
      partitions.push(merged);
    }

    // Convert to groupsByIndex
    const groupsByIndex = partitions.map(p => [...p.indices]);

    // Repair to exact sizes
    repairToExactSizes(items, groupsByIndex, groupSize, maxRepairIters);

    // Local 1-1 swap optimization to reduce delta further
    const localIters = localOptimizeOneOne(items, groupsByIndex, maxLocalIters);

    // Final sums and metrics
    const groupSums = groupsByIndex.map(g =>
      g.reduce((acc, idx) => acc + items[idx]!.capacity, 0)
    );
    const maxSum = Math.max(...groupSums);
    const minSum = Math.min(...groupSums);
    const delta = maxSum - minSum;
    const mean = groupSums.reduce((s, v) => s + v, 0) / groups;
    const variance =
      groupSums.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / groups;
    const stdev = Math.sqrt(variance);

    // Build groupsById
    const groupsById = groupsByIndex.map(g => g.map(idx => items[idx]!.id));

    return {
      groupsById,
      groupsByIndex,
      groupSums,
      delta,
      stdev,
      iterations: 1 + localIters,
      methodUsed: 'kk',
    };
  } catch (error) {
    const endTime = performance.now();
    throw createAlgorithmError(
      'kk',
      'partition',
      error instanceof Error ? error.message : 'Unknown error',
      { executionTimeMs: endTime - startTime }
    );
  }
}
