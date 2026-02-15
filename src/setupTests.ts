import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
(global as unknown as Record<string, unknown>).localStorage = localStorageMock;

// Mock window.confirm
(global as unknown as Record<string, unknown>).confirm = vi.fn(() => true);

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Fix for floating-ui instanceof checks in jsdom
Object.defineProperty(window, 'Element', {
  writable: true,
  value: window.Element || class Element {},
});

// Fix ResizeObserver not defined
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.ethereum for wallet tests
global.window = {
  ...global.window,
  ethereum: {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  }
} as unknown as typeof globalThis.window;