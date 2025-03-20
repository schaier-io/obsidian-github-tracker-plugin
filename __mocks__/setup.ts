import { jest } from '@jest/globals';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock document methods
const mockElement = {
  tagName: '',
  style: {},
  setAttribute: jest.fn(),
  getAttribute: jest.fn(),
  appendChild: jest.fn(),
  createEl: jest.fn(),
  createDiv: jest.fn().mockReturnValue({
    createEl: jest.fn(),
    style: {},
  }),
};

Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockReturnValue(mockElement as unknown as HTMLElement),
  configurable: true,
});

// Mock window methods
Object.defineProperty(window, 'open', {
  value: jest.fn(),
  configurable: true,
});

// Add any global setup for tests here

// Mock performance.now() if it doesn't exist (Node.js environment)
if (typeof performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now()),
  } as unknown as Performance;
}

// Add any other global mocks needed for tests 