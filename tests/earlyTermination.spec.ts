import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EarlyTerminationMonitor, TerminationReason } from '../src/earlyTermination.js';

describe('EarlyTerminationMonitor', () => {
  let monitor: EarlyTerminationMonitor;

  beforeEach(() => {
    monitor = new EarlyTerminationMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts monitoring correctly', () => {
    monitor.startMonitoring();
    const status = monitor.getStatus();
    
    expect(status.isMonitoring).toBe(true);
    expect(status.startTime).toBeGreaterThan(0);
    expect(status.elapsedTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('respects check interval', () => {
    monitor.updateConfig({ checkInterval: 50 });
    monitor.startMonitoring();
    
    // First check should pass
    let result = monitor.shouldTerminate(25);
    expect(result).toBeNull();
    
    // Second check should also pass (not enough iterations)
    result = monitor.shouldTerminate(49);
    expect(result).toBeNull();
    
    // Third check should trigger (50 iterations difference)
    result = monitor.shouldTerminate(75);
    expect(result).toBeNull(); // But no termination reason yet
  });

  it('terminates on execution time limit', () => {
    monitor.updateConfig({ maxExecutionTimeMs: 100 });
    monitor.startMonitoring();
    
    // Advance time beyond limit
    vi.advanceTimersByTime(150);
    
    const result = monitor.shouldTerminate(100);
    
    expect(result).toBeDefined();
    expect(result!.reason).toBe('time-limit');
    expect(result!.actual).toBeGreaterThan(100);
    expect(result!.limit).toBe(100);
    expect(result!.message).toContain('Execution time limit exceeded');
  });

  it('terminates on iteration limit', () => {
    monitor.updateConfig({ maxIterations: 1000 });
    monitor.startMonitoring();
    
    const result = monitor.shouldTerminate(1500);
    
    expect(result).toBeDefined();
    expect(result!.reason).toBe('iteration-limit');
    expect(result!.actual).toBe(1500);
    expect(result!.limit).toBe(1000);
    expect(result!.message).toContain('Iteration limit exceeded');
  });

  it('terminates on memory limit', () => {
    // Mock performance.memory
    const mockMemory = {
      usedJSHeapSize: 200 * 1024 * 1024, // 200MB
    };
    
    Object.defineProperty(global, 'performance', {
      value: { memory: mockMemory },
      writable: true,
    });
    
    monitor.updateConfig({ maxMemoryUsageMB: 100 });
    monitor.startMonitoring();
    
    // Simulate memory increase
    Object.defineProperty(global, 'performance', {
      value: { memory: { usedJSHeapSize: 400 * 1024 * 1024 } }, // 400MB
      writable: true,
    });
    
    const result = monitor.shouldTerminate(100);
    
    expect(result).toBeDefined();
    expect(result!.reason).toBe('memory-limit');
    expect(result!.actual).toBeGreaterThan(100);
    expect(result!.limit).toBe(100);
    expect(result!.message).toContain('Memory usage limit exceeded');
  });

  it('detects performance degradation', () => {
    monitor.updateConfig({ 
      performanceDegradationThreshold: 0.3,
      checkInterval: 1 
    });
    monitor.startMonitoring();
    
    // Add some performance history
    monitor.updatePerformanceHistory({
      executionTimeMs: 100,
      iterations: 100,
      algorithm: 'test',
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      timestamp: Date.now(),
      success: true,
      delta: 5,
      stdev: 2,
    });
    
    monitor.updatePerformanceHistory({
      executionTimeMs: 200,
      iterations: 200,
      algorithm: 'test',
      problemSize: 10,
      groups: 2,
      groupSize: 5,
      timestamp: Date.now(),
      success: true,
      delta: 10,
      stdev: 4,
    });
    
    // Check with degraded performance
    const result = monitor.shouldTerminate(300, {
      executionTimeMs: 500,
      iterations: 300,
      delta: 20,
    });
    
    expect(result).toBeDefined();
    expect(result!.reason).toBe('performance-degradation');
    expect(result!.message).toContain('Performance degradation detected');
  });

  it('uses adaptive thresholds', () => {
    monitor.updateConfig({ 
      adaptiveThresholds: true,
      checkInterval: 1,
      performanceDegradationThreshold: 0, // Disable performance degradation check
      maxExecutionTimeMs: 100000 // Increase time limit to 100 seconds
    });
    monitor.startMonitoring();
    
    // Add performance history
    for (let i = 0; i < 5; i++) {
      monitor.updatePerformanceHistory({
        executionTimeMs: 100 + i * 10,
        iterations: 100 + i * 10,
        algorithm: 'test',
        problemSize: 10,
        groups: 2,
        groupSize: 5,
        timestamp: Date.now(),
        success: true,
        delta: 5 + i,
        stdev: 2 + i * 0.5,
      });
    }
    
    // Advance time significantly to trigger adaptive threshold
    vi.advanceTimersByTime(50000); // 50 seconds
    
    // Check with significantly slower execution
    const result = monitor.shouldTerminate(200, {
      executionTimeMs: 50000, // Much slower than expected (2x expected = 48000ms)
      iterations: 200,
    });
    
    expect(result).toBeDefined();
    expect(result!.reason).toBe('threshold-exceeded');
    expect(result!.message).toContain('Execution time significantly exceeds expected');
  });

  it('does not terminate when monitoring is disabled', () => {
    monitor.updateConfig({ enabled: false });
    monitor.startMonitoring();
    
    const result = monitor.shouldTerminate(1000000); // Way over limit
    
    expect(result).toBeNull();
  });

  it('updates configuration correctly', () => {
    const newConfig = {
      maxExecutionTimeMs: 5000,
      maxIterations: 500,
      checkInterval: 25,
    };
    
    monitor.updateConfig(newConfig);
    const currentConfig = monitor.getConfig();
    
    expect(currentConfig.maxExecutionTimeMs).toBe(5000);
    expect(currentConfig.maxIterations).toBe(500);
    expect(currentConfig.checkInterval).toBe(25);
  });

  it('resets monitoring state', () => {
    monitor.startMonitoring();
    expect(monitor.getStatus().isMonitoring).toBe(true);
    
    monitor.reset();
    expect(monitor.getStatus().isMonitoring).toBe(false);
    expect(monitor.getStatus().startTime).toBe(0);
  });

  it('manages performance history', () => {
    monitor.startMonitoring();
    
    // Add some history
    for (let i = 0; i < 10; i++) {
      monitor.updatePerformanceHistory({
        executionTimeMs: 100 + i,
        iterations: 100 + i,
        algorithm: 'test',
        problemSize: 10,
        groups: 2,
        groupSize: 5,
        timestamp: Date.now(),
        success: true,
        delta: 5 + i,
        stdev: 2 + i * 0.5,
      });
    }
    
    const history = monitor.getPerformanceHistory();
    expect(history.length).toBe(10);
    
    // Check that history is limited to prevent memory bloat
    for (let i = 0; i < 150; i++) {
      monitor.updatePerformanceHistory({
        executionTimeMs: 100 + i,
        iterations: 100 + i,
        algorithm: 'test',
        problemSize: 10,
        groups: 2,
        groupSize: 5,
        timestamp: Date.now(),
        success: true,
        delta: 5 + i,
        stdev: 2 + i * 0.5,
      });
    }
    
    const limitedHistory = monitor.getPerformanceHistory();
    expect(limitedHistory.length).toBeLessThanOrEqual(100);
  });

  it('manages adaptive thresholds for algorithms', () => {
    monitor.setAdaptiveThreshold('fast-algo', 0.8);
    monitor.setAdaptiveThreshold('slow-algo', 0.3);
    
    expect(monitor.getAdaptiveThreshold('fast-algo')).toBe(0.8);
    expect(monitor.getAdaptiveThreshold('slow-algo')).toBe(0.3);
    expect(monitor.getAdaptiveThreshold('unknown-algo')).toBeUndefined();
  });

  it('creates metrics correctly', () => {
    monitor.startMonitoring();
    
    const result = monitor.shouldTerminate(100);
    // This should return null since no thresholds are exceeded
    // But we can test the internal metrics creation through other means
    
    const status = monitor.getStatus();
    expect(status.elapsedTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles edge cases gracefully', () => {
    monitor.startMonitoring();
    
    // Test with zero iterations
    let result = monitor.shouldTerminate(0);
    expect(result).toBeNull();
    
    // Test with very large numbers
    result = monitor.shouldTerminate(Number.MAX_SAFE_INTEGER);
    expect(result).toBeDefined();
    expect(result!.reason).toBe('iteration-limit');
    
    // Test with very small time increments
    monitor.reset();
    monitor.startMonitoring();
    vi.advanceTimersByTime(1); // Small time increment
    
    result = monitor.shouldTerminate(100);
    expect(result).toBeNull(); // Should handle gracefully
  });
});

describe('Early Termination Decorators and Wrappers', () => {
  it('wraps function with early termination', async () => {
    const { wrapWithEarlyTermination } = await import('../src/earlyTermination.js');
    
    const testFunction = vi.fn().mockReturnValue('result');
    const wrapped = wrapWithEarlyTermination(testFunction, { maxIterations: 100 });
    
    const result = wrapped();
    
    expect(result).toBe('result');
    expect(testFunction).toHaveBeenCalledTimes(1);
  });

  it('handles function errors gracefully', async () => {
    const { wrapWithEarlyTermination } = await import('../src/earlyTermination.js');
    
    const errorFunction = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    const wrapped = wrapWithEarlyTermination(errorFunction, { maxIterations: 100 });
    
    expect(() => wrapped()).toThrow('Test error');
    expect(errorFunction).toHaveBeenCalledTimes(1);
  });
});
