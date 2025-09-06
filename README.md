# balanced-k-groups

[![Coverage](https://img.shields.io/badge/coverage-92.42%25-brightgreen.svg)](https://github.com/balanced-k-groups/balanced-k-groups)
[![npm version](https://img.shields.io/npm/v/balanced-k-groups.svg)](https://www.npmjs.com/package/balanced-k-groups)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

A TypeScript library for partitioning T = N × M items (each with a positive capacity) into exactly N groups of exactly M items each, minimizing the maximum difference (delta) between group sums and, secondarily, the standard deviation.

- Node.js ≥ 16
- ESM and CommonJS builds
- TypeScript types included
- Tree-shakeable (`sideEffects: false`)
- CPU-only (no native or GPU dependencies)

---

## Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
- [API](#api)
- [Algorithms](#algorithms)
- [Algorithm Comparison](#algorithm-comparison)
- [Recommendations](#recommendations)
- [Auto Strategy](#auto-strategy)
- [Tuning Tips](#tuning-tips)
- [Usage Examples](#usage-examples)
- [Benchmarks](#benchmarks)
- [Real-World Scenarios](#real-world-scenarios)
- [CLI and Programmatic Invocation](#cli-and-programmatic-invocation)
- [Performance Notes](#performance-notes)
- [Troubleshooting](#troubleshooting)
- [Migration](#migration)
- [License](#license)

---

## Installation

```bash
npm install balanced-k-groups
# or
yarn add balanced-k-groups
# or
pnpm add balanced-k-groups
```

### Importing

ESM:
```ts
import { fromCapacities, partitionBalanced } from 'balanced-k-groups';
```

CommonJS:
```js
const { fromCapacities, partitionBalanced } = require('balanced-k-groups');
```

---

## Quick Start

```ts
import { fromCapacities, partitionBalanced } from 'balanced-k-groups';

// Each item has an id and a positive capacity
const items = fromCapacities([10, 8, 6, 4, 2, 1], 'cell_');

// Partition into 2 groups of 3 items each
const result = partitionBalanced(items, 2, 3, { method: 'auto', timeLimitMs: 500 });

console.log(result.groupsById); // [ [ ...ids ], [ ...ids ] ]
console.log('delta:', result.delta); // difference between max and min group sums
```

---

## Key Concepts
- **Balanced N×M partitioning**: exactly N groups, each with exactly M items.
- **Optimization goals**: minimize `delta = max(groupSum) − min(groupSum)`; secondarily minimize standard deviation of group sums.
- **Determinism**: use `seed` to enable reproducible runs where applicable.
- **CPU-only**: no GPU required; suitable for CI and serverless environments.

---

## API

### partitionBalanced(items, groups, groupSize, options?) → `Grouping`
- `items`: `Item[]` where each `Item = { id: string | number, capacity: number }`
- `groups`: number of groups (N)
- `groupSize`: items per group (M)
- `options` (partial list):
  - `method`: `'auto' | 'lpt' | 'kk' | 'dp' | 'backtracking' | 'ilp' | 'metaheuristic' | 'flow' | 'roundrobin'` (default: `'auto'`)
  - `timeLimitMs`: overall time budget
  - `seed`: reproducibility
  - `maxIters`, `tolerance`, `earlyStopDelta`: algorithm tuning hints
  - `preferredAlgorithms`, `disallowedAlgorithms`, `selectionStrategy ('speed' | 'quality' | 'balanced')`: steer auto selection
  - `hybrid`: optional post-refinement `{ enable?: boolean; refineIters?: number }`

Returns `Grouping`:
- `groupsById`: `(string | number)[][]`
- `groupsByIndex`: `number[][]`
- `groupSums`: `number[]`
- `delta`: `number`
- `stdev`: `number`
- `iterations?`: `number`
- `methodUsed`: `string`

### fromCapacities(capacities, idPrefix = 'item') → `Item[]`
Convenience helper to build items from numeric capacities.

---

## Algorithms

Start with `method: 'auto'` for most cases. You can also call a specific method.

- **roundrobin** (very fast baseline)
  - Use when: immediate baseline, very large inputs, strict latency.
  - Pros: extremely fast, simple.
  - Cons: balance may be weaker than LPT/KK.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'roundrobin' });
  ```

- **lpt** (Longest Processing Time: greedy + local refinement)
  - Use when: general-purpose sizes from small to large.
  - Pros: strong quality; 1↔1 and 2↔2 local refinements.
  - Cons: slower than roundrobin; refinement adds compute cost.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'lpt', maxIters: 200 });
  ```

- **kk** (Karmarkar–Karp inspired with exact-size repair)
  - Use when: small–medium; exact group sizes required.
  - Pros: competitive quality; enforces exact sizes.
  - Cons: not always better than LPT.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'kk' });
  ```

- **dp / backtracking** (exact/structured, tiny–small only)
  - Use when: tiny instances; optimality benchmarks.
  - Cons: exponential; avoid on medium/large.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'dp', timeLimitMs: 2000 });
  const res2 = partitionBalanced(items, groups, groupSize, { method: 'backtracking', timeLimitMs: 2000 });
  ```

- **flow** (min-cost flow / LP relaxation + rounding)
  - Use when: structured small–medium; relaxation benefits.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'flow' });
  ```

- **metaheuristic** (Genetic / SA / Tabu)
  - Use when: medium–large with time budget; explore solution space.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'metaheuristic', maxIters: 2000, timeLimitMs: 10000 });
  ```

- **ilp** (external solver)
  - Hooks prepared; falls back gracefully when solver not available.
  ```ts
  const res = partitionBalanced(items, groups, groupSize, { method: 'ilp', timeLimitMs: 5000 });
  ```

### Algorithm Comparison

| Algorithm     | Speed     | Quality | Problem Size   | Notes                                           |
|---------------|-----------|---------|----------------|-------------------------------------------------|
| roundrobin    | Very Fast | Good    | Any            | Baseline, cyclic distribution                   |
| lpt           | Fast      | Great   | Small–Large    | Greedy + local refinement (1↔1, 2↔2)            |
| kk            | Fast      | Great   | Small–Medium   | Differencing heuristic, exact-size repair       |
| dp            | Slow      | Optimal | Tiny–Small     | Scaling, meet-in-the-middle, branch-and-bound   |
| backtracking  | Slow      | Optimal | Tiny–Small     | Pruning, bounds, early termination              |
| flow          | Medium    | Good    | Small–Medium   | Min-cost flow / LP relaxation + rounding        |
| metaheuristic | Medium    | Good    | Medium–Large   | Genetic / SA / Tabu; tunable parameters         |
| ilp           | Depends   | Optimal | Small          | External solver integration (planned)           |

### Recommendations

- **Unknown size**: use `auto`.
- **≤ 12 items**: `dp` or `backtracking`.
- **12–60 items**: `lpt`, `kk`, `flow`.
- **> 60 items**: `lpt`, `metaheuristic`.

### Auto Strategy

`method: 'auto'` will:
- Build a baseline with `roundrobin`.
- Try strong heuristics (`lpt`, `kk`).
- Consult performance history, preferences, and `selectionStrategy`.
- Optionally refine the best solution via `hybrid`.

### Tuning Tips

- Use `preferredAlgorithms` and `selectionStrategy` to bias speed or quality.
- Provide `seed` for reproducibility.
- Enable `hybrid` to add a refinement pass when time allows.

---

## Usage Examples

### Example 1: Battery cells (18650-like) into 3 balanced packs
```ts
import { fromCapacities, partitionBalanced } from 'balanced-k-groups';

// Generate demo capacities (mAh)
const capacities = Array.from({ length: 600 }, (_, i) => 2400 + (i % 100));
const items = fromCapacities(capacities, 'cell_');

const groups = 3;
const groupSize = 200;

const result = partitionBalanced(items, groups, groupSize, {
  method: 'lpt',
  timeLimitMs: 2000,
  maxIters: 800,
});

console.log('delta:', result.delta);
console.log('group sums:', result.groupSums);
```

### Example 2: Task scheduling into equally sized worker batches
```ts
import { partitionBalanced } from 'balanced-k-groups';

// Each task has an estimated run time
const tasks = [
  { id: 't1', capacity: 3.2 },
  { id: 't2', capacity: 1.5 },
  // ...
];

const result = partitionBalanced(tasks, /*workers*/ 4, /*tasks per worker*/ 10, {
  method: 'auto',
  selectionStrategy: 'speed',
  timeLimitMs: 500,
});

console.log(result.groupsById); // 4 groups of task IDs
```

### Example 3: Inventory kitting with exact sizes
```ts
import { fromCapacities, partitionBalanced } from 'balanced-k-groups';

const weights = [1.1, 2.3, 1.7, 0.9, 1.2, 2.0, 1.6, 0.8];
const items = fromCapacities(weights, 'sku_');

const kits = partitionBalanced(items, 2, 4, { method: 'kk' });
console.log('delta:', kits.delta);
```

---

## Benchmarks

### CLI (in this repository)
```bash
npm run bench
```
Runs multiple iterations comparing algorithms across sizes, printing average time, average delta, and totals.

### Programmatic
```ts
// Internal API (subject to change in this version)
import { BenchmarkRunner } from 'balanced-k-groups/dist/benchmark.mjs';
import { fromCapacities } from 'balanced-k-groups';

const runner = new BenchmarkRunner();
const items = fromCapacities([8, 7, 6, 5]);

const single = await runner.runSingleBenchmark('lpt', items, 2, 2, { timeLimitMs: 2000 });
console.log('Single run:', single);

const comparison = await runner.runComprehensiveBenchmark({
  algorithms: ['roundrobin', 'lpt', 'kk'],
  problemSizes: [4, 8, 12],
  groupCounts: [2],
  groupSizes: [2, 4],
  iterations: 2,
  timeLimitMs: 5000,
});
console.log('Summary:', comparison.summary);
console.log('Samples:', comparison.results.slice(0, 3));
```

---

## Real-World Scenarios
- **Battery pack design**: group cells into series/parallel packs with near-identical capacity sums.
- **Batch job scheduling**: split tasks into equal-sized batches with balanced total runtime.
- **Warehouse kitting**: assemble kits with fixed item counts that are weight-balanced.
- **Dataset sharding**: evenly distribute records into fixed-size shards minimizing skew.

---

## CLI and Programmatic Invocation

- Minimal run:
  ```bash
  node -e "(async()=>{const lib=await import('balanced-k-groups');const items=lib.fromCapacities([5,4,3,2,1,1]);console.log(lib.partitionBalanced(items,2,3,{method:'auto'}));})();"
  ```

- With time budget and preferences:
  ```bash
  node -e "(async()=>{const lib=await import('balanced-k-groups');const items=lib.fromCapacities(Array.from({length:60},()=>1+Math.random()*9));console.log(lib.partitionBalanced(items,3,20,{method:'auto',timeLimitMs:800,preferredAlgorithms:['lpt','kk'],selectionStrategy:'quality'}));})();"
  ```

---

## Performance Notes
- Prefer `auto`, `lpt`, `roundrobin`, or `metaheuristic` on large inputs.
- Use `hybrid` to refine a good heuristic solution within your time budget.
- The library uses an in-memory cache for evaluation results to avoid recomputing identical groupings.
- Keep arrays compact and avoid excessive copying (inputs are copied internally to ensure immutability).
- Set `timeLimitMs` appropriate to your workload; use `selectionStrategy: 'speed'` for latency-sensitive cases.
- Avoid exact methods (`dp`, `backtracking`) beyond tiny–small sizes; prefer `lpt`/`kk`/`flow`.
- Use `seed` for repeatable runs; use `bench/` utilities and performance reporting to track improvements.

---

## Troubleshooting
- **ValidationError**: ensure unique IDs, positive finite capacities, and `items.length === groups × groupSize`.
- **TimeoutError**: increase `timeLimitMs` or choose faster methods (`roundrobin`, `lpt`).
- **MemoryError**: avoid exact methods (`dp`, `backtracking`) on large instances.
- **NumericalError**: reduce capacity ranges; DP uses scaling internally.
- Tips: set `selectionStrategy: 'speed'` for latency, enable `hybrid` for quality, and you can call `evaluateGrouping()` to verify solution quality programmatically.

---

## Migration

### v1 → v2 (planned)

Potential changes:
- `algorithmConfig` evaluation option naming alignment
- Additional ILP solvers and configuration keys
- Expanded performance history APIs

Deprecations:
- Old option names will be supported for at least one minor version
- Warnings will be emitted in development builds

Steps:
1. Review release notes and changelog
2. Update `PartitionOptions` usage per README
3. Re-run tests and benchmarks

---

## License
MIT
