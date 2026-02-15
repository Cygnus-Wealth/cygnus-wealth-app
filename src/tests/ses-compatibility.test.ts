import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSESEnvironment, safeDate } from '../utils/ses-compatibility';

describe('SES Compatibility', () => {
  describe('isSESEnvironment', () => {
    it('should detect non-SES environment', () => {
      expect(isSESEnvironment()).toBe(false);
    });
    
    it('should detect SES environment with lockdown', () => {
      (globalThis as Record<string, unknown>).lockdown = () => {};
      expect(isSESEnvironment()).toBe(true);
      delete (globalThis as Record<string, unknown>).lockdown;
    });
    
    it('should detect SES environment with harden', () => {
      (globalThis as Record<string, unknown>).harden = () => {};
      expect(isSESEnvironment()).toBe(true);
      delete (globalThis as Record<string, unknown>).harden;
    });
  });
  
  describe('safeDate', () => {
    it('should provide working date functions', () => {
      const now = safeDate.now();
      expect(typeof now).toBe('number');
      expect(now).toBeGreaterThan(0);
    });
    
    it('should handle toISOString', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const iso = safeDate.toISOString(date);
      expect(iso).toBe('2024-01-01T12:00:00.000Z');
    });
    
    it('should handle toLocaleString with fallback', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = safeDate.toLocaleString(date);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle toLocaleTimeString with fallback', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = safeDate.toLocaleTimeString(date);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should fallback gracefully when locale methods throw', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      
      // Mock toLocaleString to throw
      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = vi.fn(() => {
        throw new Error('SES restriction');
      });
      
      const result = safeDate.toLocaleString(date);
      expect(result).toBe(date.toString());
      
      // Restore
      Date.prototype.toLocaleString = originalToLocaleString;
    });
  });
  
  describe('Console warning filter', () => {
    let originalWarn: typeof console.warn;
    let warnSpy: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
      originalWarn = console.warn;
      warnSpy = vi.fn();
      
      // Apply our filter
      console.warn = function(...args) {
        const message = args[0]?.toString() || '';
        if (message.includes('dateTaming') || 
            message.includes('mathTaming') || 
            message.includes('Removing unpermitted intrinsics')) {
          return;
        }
        warnSpy(...args);
      };
    });
    
    afterEach(() => {
      console.warn = originalWarn;
    });
    
    it('should filter SES warnings', () => {
      console.warn("SES The 'dateTaming' option is deprecated");
      console.warn("SES The 'mathTaming' option is deprecated");
      console.warn("SES Removing unpermitted intrinsics");
      
      expect(warnSpy).not.toHaveBeenCalled();
    });
    
    it('should allow other warnings through', () => {
      console.warn('Regular warning message');
      console.warn('Another warning');
      
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith('Regular warning message');
      expect(warnSpy).toHaveBeenCalledWith('Another warning');
    });
  });
});