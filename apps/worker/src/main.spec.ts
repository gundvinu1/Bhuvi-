import { APP_NAME, APP_VERSION } from '@bhuvi/shared';

describe('BhuviWorker Foundation', () => {
  it('should have valid application metadata', () => {
    expect(APP_NAME).toBe('BHUVI');
    expect(APP_VERSION).toBe('1.0.0');
  });

  it('should have standard node environment available', () => {
    expect(process.version).toBeDefined();
    expect(typeof process.version).toBe('string');
  });
});

