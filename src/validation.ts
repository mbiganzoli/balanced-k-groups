import { Item, isItemArray } from './types.js';
import {
  ValidationError,
  InfeasibleError,
  createValidationError,
} from './errors.js';

/**
 * Asserts that all items have unique IDs
 * @param items Array of items to validate
 * @throws ValidationError if duplicate IDs are found
 */
export function assertUniqueIds(items: Item[]): void {
  if (!isItemArray(items)) {
    throw createValidationError('items', items, 'array of valid Item objects');
  }

  const seenIds = new Set<string | number>();
  const duplicates: (string | number)[] = [];

  for (let i = 0; i < items.length; i++) {
    const id = items[i]!.id;
    if (seenIds.has(id)) {
      duplicates.push(id);
    } else {
      seenIds.add(id);
    }
  }

  if (duplicates.length > 0) {
    throw new ValidationError(
      `Duplicate item IDs found: ${duplicates.join(', ')}`,
      { duplicateIds: duplicates, totalItems: items.length }
    );
  }
}

/**
 * Validates that all item capacities are positive, finite numbers
 * @param items Array of items to validate
 * @throws ValidationError if invalid capacities are found
 */
export function validateCapacities(items: Item[]): void {
  if (!isItemArray(items)) {
    throw createValidationError('items', items, 'array of valid Item objects');
  }

  const invalidItems: Array<{
    index: number;
    id: string | number;
    capacity: number;
    reason: string;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const { capacity } = item;

    if (typeof capacity !== 'number') {
      invalidItems.push({
        index: i,
        id: item.id,
        capacity,
        reason: 'not a number',
      });
    } else if (!isFinite(capacity)) {
      invalidItems.push({
        index: i,
        id: item.id,
        capacity,
        reason: 'not finite',
      });
    } else if (capacity <= 0) {
      invalidItems.push({
        index: i,
        id: item.id,
        capacity,
        reason: 'not positive',
      });
    } else if (Number.isNaN(capacity)) {
      invalidItems.push({
        index: i,
        id: item.id,
        capacity,
        reason: 'is NaN',
      });
    }
  }

  if (invalidItems.length > 0) {
    const reasons = invalidItems.map(
      item =>
        `Item ${item.id} (index ${item.index}): capacity ${item.capacity} ${item.reason}`
    );
    throw new ValidationError(
      `Invalid capacities found:\n${reasons.join('\n')}`,
      { invalidItems, totalItems: items.length }
    );
  }
}

/**
 * Validates the groups and groupSize parameters
 * @param groups Number of groups to create
 * @param groupSize Number of items per group
 * @throws ValidationError if parameters are invalid
 */
export function validateGroupParameters(
  groups: number,
  groupSize: number
): void {
  if (typeof groups !== 'number' || !Number.isInteger(groups) || groups <= 0) {
    throw createValidationError('groups', groups, 'positive integer');
  }

  if (
    typeof groupSize !== 'number' ||
    !Number.isInteger(groupSize) ||
    groupSize <= 0
  ) {
    throw createValidationError('groupSize', groupSize, 'positive integer');
  }

  if (groups > 1000) {
    throw createValidationError(
      'groups',
      groups,
      'reasonable number (≤ 1000)',
      'too many groups may cause performance issues'
    );
  }

  if (groupSize > 1000) {
    throw createValidationError(
      'groupSize',
      groupSize,
      'reasonable number (≤ 1000)',
      'too large group size may cause performance issues'
    );
  }
}

/**
 * Validates that the items array length matches groups × groupSize
 * @param items Array of items
 * @param groups Number of groups
 * @param groupSize Number of items per group
 * @throws ValidationError if lengths don't match
 */
export function validateItemCount(
  items: Item[],
  groups: number,
  groupSize: number
): void {
  const expectedCount = groups * groupSize;
  const actualCount = items.length;

  if (actualCount !== expectedCount) {
    throw new ValidationError(
      `Item count mismatch: expected ${expectedCount} items (${groups} groups × ${groupSize} items), got ${actualCount}`,
      {
        expectedCount,
        actualCount,
        groups,
        groupSize,
      }
    );
  }
}

/**
 * Checks if the partitioning problem is feasible
 * @param items Array of items to partition
 * @param groups Number of groups to create
 * @param groupSize Number of items per group
 * @returns true if feasible, false otherwise
 */
export function isFeasible(
  items: Item[],
  groups: number,
  groupSize: number
): boolean {
  try {
    // Validate all inputs
    assertUniqueIds(items);
    validateCapacities(items);
    validateGroupParameters(groups, groupSize);
    validateItemCount(items, groups, groupSize);
    return true;
  } catch (error) {
    // If any validation fails, the problem is not feasible
    return false;
  }
}

/**
 * Comprehensive validation of all partitioning inputs
 * @param items Array of items to partition
 * @param groups Number of groups to create
 * @param groupSize Number of items per group
 * @throws ValidationError or InfeasibleError if validation fails
 */
export function validatePartitionInputs(
  items: Item[],
  groups: number,
  groupSize: number
): void {
  // Validate basic types and structure
  if (!Array.isArray(items)) {
    throw createValidationError('items', items, 'array');
  }

  if (items.length === 0) {
    throw new ValidationError('Items array cannot be empty', { itemCount: 0 });
  }

  // Validate group parameters
  validateGroupParameters(groups, groupSize);

  // Validate item count matches expected
  validateItemCount(items, groups, groupSize);

  // Validate each item
  if (!isItemArray(items)) {
    throw createValidationError('items', items, 'array of valid Item objects');
  }

  // Validate unique IDs
  assertUniqueIds(items);

  // Validate capacities
  validateCapacities(items);

  // Check for edge cases that make the problem infeasible
  const totalCapacity = items.reduce((sum, item) => sum + item.capacity, 0);
  if (totalCapacity === 0) {
    throw new InfeasibleError(
      'Total capacity is zero - cannot create meaningful groups'
    );
  }

  // Check for numerical precision issues
  const maxCapacity = Math.max(...items.map(item => item.capacity));
  const minCapacity = Math.min(...items.map(item => item.capacity));
  const capacityRange = maxCapacity - minCapacity;

  if (capacityRange > Number.MAX_SAFE_INTEGER / 1000) {
    throw new ValidationError(
      'Capacity range is too large and may cause numerical precision issues',
      { maxCapacity, minCapacity, capacityRange }
    );
  }
}

/**
 * Validates partition options
 * @param options Partition options to validate
 * @throws ValidationError if options are invalid
 */
export function validatePartitionOptions(
  options: Record<string, unknown>
): void {
  if (typeof options !== 'object' || options === null) {
    throw createValidationError('options', options, 'object');
  }

  // Validate method
  if ('method' in options && (options as any)['method'] !== undefined) {
    const validMethods = [
      'auto',
      'lpt',
      'kk',
      'dp',
      'backtracking',
      'ilp',
      'metaheuristic',
      'flow',
      'roundrobin',
    ];
    if (
      typeof (options as any)['method'] !== 'string' ||
      !validMethods.includes((options as any)['method'])
    ) {
      throw createValidationError(
        'options.method',
        (options as any)['method'],
        `one of: ${validMethods.join(', ')}`
      );
    }
  }

  // Validate scale
  if ('scale' in options && (options as any)['scale'] !== undefined) {
    if (
      (options as any)['scale'] !== 'auto' &&
      (typeof (options as any)['scale'] !== 'number' ||
        (options as any)['scale'] <= 0 ||
        !isFinite((options as any)['scale']))
    ) {
      throw createValidationError(
        'options.scale',
        (options as any)['scale'],
        "'auto' or positive finite number"
      );
    }
  }

  // Validate numeric options
  const numericOptions = [
    'timeLimitMs',
    'seed',
    'maxIters',
    'threads',
    'tolerance',
    'earlyStopDelta',
    // allow hybrid refine iterations if provided
    'refineIters',
  ];
  for (const option of numericOptions) {
    if (option in options && (options as any)[option] !== undefined) {
      const value = (options as any)[option];
      if (typeof value !== 'number' || !isFinite(value) || value < 0) {
        throw createValidationError(
          `options.${option}`,
          value,
          'non-negative finite number'
        );
      }
    }
  }

  // Validate boolean options
  if (
    'returnIntermediate' in options &&
    (options as any)['returnIntermediate'] !== undefined
  ) {
    if (typeof (options as any)['returnIntermediate'] !== 'boolean') {
      throw createValidationError(
        'options.returnIntermediate',
        (options as any)['returnIntermediate'],
        'boolean'
      );
    }
  }

  // Optional arrays of algorithms
  const algoArrays = ['preferredAlgorithms', 'disallowedAlgorithms'];
  for (const key of algoArrays) {
    if (key in options && (options as any)[key] !== undefined) {
      const val = (options as any)[key];
      if (!Array.isArray(val) || !val.every(v => typeof v === 'string')) {
        throw createValidationError(
          `options.${key}`,
          val,
          'array of algorithm names'
        );
      }
    }
  }

  // Selection strategy
  if (
    'selectionStrategy' in options &&
    (options as any)['selectionStrategy'] !== undefined
  ) {
    const val = (options as any)['selectionStrategy'];
    if (!['speed', 'quality', 'balanced'].includes(val as any)) {
      throw createValidationError(
        'options.selectionStrategy',
        val,
        "one of: 'speed', 'quality', 'balanced'"
      );
    }
  }
}

/**
 * Enforces input immutability by creating deep copies
 * @param items Original items array
 * @returns Deep copy of items array
 */
export function ensureInputImmutability(items: Item[]): Item[] {
  return items.map(item => ({
    id: item.id,
    capacity: item.capacity,
  }));
}
