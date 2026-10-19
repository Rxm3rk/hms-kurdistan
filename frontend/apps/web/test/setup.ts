/**
 * Runs before each test file in the jsdom environment: registers @testing-library/jest-dom's matchers
 * on Vitest's expect and unmounts what React Testing Library rendered after each test (Vitest globals
 * are off, so the library cannot register its own cleanup).
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
