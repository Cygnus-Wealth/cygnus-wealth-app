/**
 * Suppress specific console warnings that are outside our control
 * This is primarily for third-party library warnings that don't affect functionality
 */

// Store the original console.warn function
const originalWarn = console.warn;

// List of warning patterns to suppress
const warningsToSuppress = [
  /MouseEvent\.mozInputSource is deprecated/,
  /Use PointerEvent\.pointerType instead/
];

/**
 * Initialize warning suppression
 * Call this early in your application initialization
 */
export function initializeWarningSuppression() {
  console.warn = function(...args: unknown[]) {
    const message = args[0]?.toString() || '';
    
    // Check if this warning should be suppressed
    const shouldSuppress = warningsToSuppress.some(pattern => 
      pattern.test(message)
    );
    
    // If not suppressed, call the original console.warn
    if (!shouldSuppress) {
      originalWarn.apply(console, args);
    }
  };
}

/**
 * Restore original console.warn behavior
 */
export function restoreConsoleWarn() {
  console.warn = originalWarn;
}