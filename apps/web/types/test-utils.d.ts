import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void>, TestingLibraryMatchers<T, void> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
