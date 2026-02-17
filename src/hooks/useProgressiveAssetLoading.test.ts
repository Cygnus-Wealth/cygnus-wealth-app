import { describe, it, expect } from 'vitest';

// Directly test that the loadBalance function in useProgressiveAssetLoading
// does NOT contain simulation code (Math.random, setTimeout with random delay)
describe('useProgressiveAssetLoading - no simulation', () => {
  it('should not contain simulated balance loading with Math.random', async () => {
    // Read the source and check for simulation patterns
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, './useProgressiveAssetLoading.ts');
    const source = fs.readFileSync(filePath, 'utf-8');

    // The old loadBalance had: Math.random() * 2000 + 500 (simulated delay)
    // and: Math.random() < 0.1 (simulated error rate)
    // and: Math.random() * 1000 (simulated balance)
    const hasRandomBalance = /Math\.random\(\)\s*\*\s*1000/.test(source);
    const hasRandomError = /Math\.random\(\)\s*<\s*0\.1/.test(source);
    const hasSimulatedDelay = /Math\.random\(\)\s*\*\s*2000/.test(source);

    expect(hasRandomBalance).toBe(false);
    expect(hasRandomError).toBe(false);
    expect(hasSimulatedDelay).toBe(false);
  });

  it('loadBalance should not generate fake "Balance fetch failed" errors', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, './useProgressiveAssetLoading.ts');
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).not.toContain("'Balance fetch failed'");
    expect(source).not.toContain('"Balance fetch failed"');
  });
});
