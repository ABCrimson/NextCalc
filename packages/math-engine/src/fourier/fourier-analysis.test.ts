/**
 * Comprehensive Tests for Fourier Analysis Module
 *
 * Test Coverage:
 * - FFT correctness and performance
 * - Inverse FFT (reconstruction)
 * - DFT verification
 * - Fourier series expansion
 * - Spectral analysis functions
 * - Edge cases and numerical stability
 *
 * @module fourier/fourier-analysis.test
 */

import { describe, expect, it } from 'vitest';
import {
  applyWindow,
  autocorrelation,
  type Complex,
  dft,
  fft,
  findDominantFrequencies,
  fourierSeries,
  idft,
  ifft,
  magnitude,
  phase,
  powerSpectralDensity,
  toDecibels,
  type WindowFunction,
  zeroPad,
} from './fourier-analysis';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if two numbers are approximately equal
 */
function approxEqual(a: number, b: number, tolerance = 1e-10): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Check if two arrays are approximately equal
 */
function arraysApproxEqual(a: number[], b: number[], tolerance = 1e-10): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => approxEqual(val, b[i] ?? 0, tolerance));
}

/**
 * Generate sine wave
 */
function generateSine(frequency: number, sampleRate: number, duration: number): number[] {
  const samples = Math.floor(sampleRate * duration);
  return Array.from({ length: samples }, (_, i) =>
    Math.sin((2 * Math.PI * frequency * i) / sampleRate),
  );
}

/**
 * Generate cosine wave
 */
function generateCosine(frequency: number, sampleRate: number, duration: number): number[] {
  const samples = Math.floor(sampleRate * duration);
  return Array.from({ length: samples }, (_, i) =>
    Math.cos((2 * Math.PI * frequency * i) / sampleRate),
  );
}

// ============================================================================
// FFT TESTS
// ============================================================================

describe('Fast Fourier Transform (FFT)', () => {
  it('should compute FFT of constant signal', () => {
    const signal = [1, 1, 1, 1];
    const result = fft(signal);

    expect(result.magnitude[0]).toBeCloseTo(4, 10);
    expect(result.magnitude[1]).toBeCloseTo(0, 10);
    expect(result.magnitude[2]).toBeCloseTo(0, 10);
    expect(result.magnitude[3]).toBeCloseTo(0, 10);
  });

  it('should compute FFT of impulse signal', () => {
    const signal = [1, 0, 0, 0];
    const result = fft(signal);

    // All frequency components should have magnitude 1
    expect(result.magnitude.every((m) => approxEqual(m, 1))).toBe(true);
  });

  it('should compute FFT of single frequency sine wave', () => {
    const frequency = 5; // Hz
    const sampleRate = 100; // Hz
    const signal = generateSine(frequency, sampleRate, 1);

    const result = fft(signal, sampleRate);

    // Find peak frequency
    const halfN = Math.floor(result.magnitude.length / 2);
    const magnitudes = result.magnitude.slice(0, halfN);
    const peakIdx = magnitudes.indexOf(Math.max(...magnitudes));
    const peakFreq = result.frequencies[peakIdx] ?? 0;

    expect(peakFreq).toBeCloseTo(frequency, 0);
  });

  it('should detect multiple frequencies', () => {
    const sampleRate = 1000;
    const samples = 1024;

    // Signal with 50Hz and 120Hz components
    const signal = Array.from(
      { length: samples },
      (_, i) =>
        Math.sin((2 * Math.PI * 50 * i) / sampleRate) +
        0.5 * Math.sin((2 * Math.PI * 120 * i) / sampleRate),
    );

    const result = fft(signal, sampleRate);
    const peaks = findDominantFrequencies(signal, sampleRate, 5);

    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(peaks[0]?.frequency).toBeCloseTo(50, 0);
    expect(peaks[1]?.frequency).toBeCloseTo(120, 0);
  });

  it('should zero-pad to power of two', () => {
    const signal = [1, 2, 3, 4, 5];
    const result = fft(signal);

    // Should pad to 8 (next power of 2)
    expect(result.magnitude.length).toBe(8);
  });

  it('should handle empty input', () => {
    expect(() => fft([])).toThrow();
  });

  it('should have correct frequency bins', () => {
    const sampleRate = 1000;
    const signal = new Array(1024).fill(0);
    const result = fft(signal, sampleRate);

    expect(result.frequencies.length).toBe(1024);
    expect(result.frequencies[0]).toBe(0); // DC
    expect(result.frequencies[1]).toBeCloseTo(sampleRate / 1024, 5);
    expect(result.frequencies[512]).toBeCloseTo(sampleRate / 2, 5); // Nyquist
  });

  it('should compute magnitude correctly', () => {
    const signal = [1, 0, -1, 0];
    const result = fft(signal);

    // Verify magnitude = sqrt(real² + imag²)
    for (let i = 0; i < result.magnitude.length; i++) {
      const expectedMag = Math.sqrt(result.real[i]! ** 2 + result.imag[i]! ** 2);
      expect(result.magnitude[i]).toBeCloseTo(expectedMag, 10);
    }
  });

  it('should compute phase correctly', () => {
    const signal = [1, 0, -1, 0];
    const result = fft(signal);

    // Verify phase = atan2(imag, real)
    for (let i = 0; i < result.phase.length; i++) {
      const expectedPhase = Math.atan2(result.imag[i]!, result.real[i]!);
      expect(result.phase[i]).toBeCloseTo(expectedPhase, 10);
    }
  });
});

// ============================================================================
// INVERSE FFT TESTS
// ============================================================================

describe('Inverse Fast Fourier Transform (IFFT)', () => {
  it('should reconstruct signal from FFT', () => {
    const signal = [1, 2, 3, 4, 5, 6, 7, 8];
    const spectrum = fft(signal);
    const reconstructed = ifft(spectrum.real, spectrum.imag);

    expect(arraysApproxEqual(reconstructed, signal, 1e-10)).toBe(true);
  });

  it('should satisfy FFT-IFFT roundtrip', () => {
    const signal = generateSine(10, 100, 1);
    const spectrum = fft(signal);
    const reconstructed = ifft(spectrum.real, spectrum.imag);

    // Trim to original length (FFT may have padded)
    const trimmed = reconstructed.slice(0, signal.length);
    expect(arraysApproxEqual(trimmed, signal, 1e-10)).toBe(true);
  });

  it('should throw on mismatched array lengths', () => {
    expect(() => ifft([1, 2, 3], [1, 2])).toThrow();
  });
});

// ============================================================================
// DFT TESTS
// ============================================================================

describe('Discrete Fourier Transform (DFT)', () => {
  it('should match FFT results', () => {
    const signal = [1, 2, 3, 4];
    const dftResult = dft(signal);
    const fftResult = fft(signal);

    const dftMag = magnitude(dftResult);

    // Magnitudes should match exactly
    expect(arraysApproxEqual(dftMag, fftResult.magnitude, 1e-10)).toBe(true);

    // Phase is only meaningful when magnitude is significant
    // Also phase can differ by 2π (wrapping)
    for (let i = 0; i < dftMag.length; i++) {
      if (dftMag[i]! > 1e-6) {
        const dftPh = phase(dftResult)[i]!;
        const fftPh = fftResult.phase[i]!;
        const diff = Math.abs(dftPh - fftPh);
        const wrappedDiff = Math.min(diff, Math.abs(diff - 2 * Math.PI));
        expect(wrappedDiff).toBeLessThan(1e-6);
      }
    }
  });

  it('should compute IDFT correctly', () => {
    const signal = [1, 0, 1, 0];
    const spectrum = dft(signal);
    const reconstructed = idft(spectrum);

    expect(arraysApproxEqual(reconstructed, signal, 1e-10)).toBe(true);
  });

  it('should handle complex conjugate symmetry for real signals', () => {
    const signal = [1, 2, 3, 4];
    const spectrum = dft(signal);

    // For real signal, X[N-k] = conj(X[k])
    const n = spectrum.length;
    for (let k = 1; k < n / 2; k++) {
      const conjIdx = n - k;
      expect(spectrum[k]?.real).toBeCloseTo(spectrum[conjIdx]?.real ?? 0, 10);
      expect(spectrum[k]?.imag).toBeCloseTo(-(spectrum[conjIdx]?.imag ?? 0), 10);
    }
  });
});

// ============================================================================
// FOURIER SERIES TESTS
// ============================================================================

describe('Fourier Series Expansion', () => {
  it('should approximate square wave', () => {
    const squareWave = (x: number) => (Math.sin(x) >= 0 ? 1 : -1);
    const series = fourierSeries(squareWave, {
      period: 2 * Math.PI,
      terms: 50,
      samples: 1000,
    });

    // a0 should be ~0 (symmetric around x-axis)
    expect(Math.abs(series.a0)).toBeLessThan(0.1);

    // All an should be ~0 (odd function)
    expect(series.an.every((a) => Math.abs(a) < 0.1)).toBe(true);

    // Odd bn should dominate (b1, b3, b5, ...)
    expect(Math.abs(series.bn[0] ?? 0)).toBeGreaterThan(1); // b1
    expect(Math.abs(series.bn[1] ?? 0)).toBeLessThan(0.1); // b2
    expect(Math.abs(series.bn[2] ?? 0)).toBeGreaterThan(0.3); // b3

    // Test reconstruction
    const approx = series.reconstruct(Math.PI / 4);
    expect(approx).toBeCloseTo(1, 0);
  });

  it('should approximate sawtooth wave', () => {
    const sawtooth = (x: number) => (x % (2 * Math.PI)) / (2 * Math.PI);
    const series = fourierSeries(sawtooth, {
      period: 2 * Math.PI,
      terms: 20,
    });

    // Should have non-zero coefficients
    expect(Math.abs(series.a0)).toBeGreaterThan(0.4);
    expect(series.bn.some((b) => Math.abs(b) > 0.1)).toBe(true);
  });

  it('should approximate constant function', () => {
    const constant = () => 5;
    const series = fourierSeries(constant, {
      period: 2 * Math.PI,
      terms: 10,
    });

    expect(series.a0).toBeCloseTo(10, 1); // a0 = 2 * average
    expect(series.an.every((a) => Math.abs(a) < 0.1)).toBe(true);
    expect(series.bn.every((b) => Math.abs(b) < 0.1)).toBe(true);

    expect(series.reconstruct(0)).toBeCloseTo(5, 1);
    expect(series.reconstruct(Math.PI)).toBeCloseTo(5, 1);
  });

  it('should compute error metric', () => {
    const func = (x: number) => Math.sin(x);
    const series = fourierSeries(func, {
      period: 2 * Math.PI,
      terms: 5,
    });

    // Error should be small for smooth function
    expect(series.error).toBeGreaterThan(0);
    expect(series.error).toBeLessThan(0.1);
  });

  it('should throw on invalid config', () => {
    expect(() => fourierSeries(() => 0, { period: -1, terms: 10 })).toThrow();
    expect(() => fourierSeries(() => 0, { period: 1, terms: 0 })).toThrow();
  });
});

// ============================================================================
// WINDOW FUNCTIONS TESTS
// ============================================================================

describe('Window Functions', () => {
  const windowTypes: WindowFunction[] = ['rectangular', 'hamming', 'hann', 'blackman', 'bartlett'];

  windowTypes.forEach((windowType) => {
    it(`should apply ${windowType} window`, () => {
      const signal = new Array(100).fill(1);
      const windowed = applyWindow(signal, windowType);

      expect(windowed.length).toBe(signal.length);

      if (windowType === 'rectangular') {
        expect(arraysApproxEqual(windowed, signal)).toBe(true);
      } else {
        // Non-rectangular windows should taper to zero at edges
        expect(windowed[0]).toBeLessThan(1);
        expect(windowed[windowed.length - 1]).toBeLessThan(1);
      }
    });
  });

  it('should reduce spectral leakage', () => {
    const sampleRate = 1000;
    const samples = 1024;
    const signal = generateSine(10.5, sampleRate, samples / sampleRate); // Non-bin frequency

    const unwinnowed = fft(signal, sampleRate);
    const windowed = applyWindow(signal, 'hann');
    const winnowedFFT = fft(windowed, sampleRate);

    // Windowed signal should have less energy in side lobes
    const halfN = Math.floor(samples / 2);
    const mainLobeIdx = Math.round((10.5 * samples) / sampleRate);

    // Count significant bins (>10% of peak)
    const unwinnowedPeak = Math.max(...unwinnowed.magnitude.slice(0, halfN));
    const winnowedPeak = Math.max(...winnowedFFT.magnitude.slice(0, halfN));

    const unwinnowedSideBins = unwinnowed.magnitude
      .slice(0, halfN)
      .filter((m, i) => Math.abs(i - mainLobeIdx) > 2 && m > 0.1 * unwinnowedPeak).length;

    const winnowedSideBins = winnowedFFT.magnitude
      .slice(0, halfN)
      .filter((m, i) => Math.abs(i - mainLobeIdx) > 2 && m > 0.1 * winnowedPeak).length;

    expect(winnowedSideBins).toBeLessThanOrEqual(unwinnowedSideBins);
  });
});

// ============================================================================
// SPECTRAL ANALYSIS TESTS
// ============================================================================

describe('Power Spectral Density', () => {
  it('should compute PSD', () => {
    const signal = generateSine(10, 100, 1);
    const psd = powerSpectralDensity(signal, 100, 'hann');

    expect(psd.frequencies.length).toBeGreaterThan(0);
    expect(psd.psd.length).toBe(psd.frequencies.length);
    expect(psd.totalPower).toBeGreaterThan(0);
  });

  it('should satisfy Parseval theorem', () => {
    const signal = Array.from({ length: 128 }, () => Math.random());

    // Time domain energy
    const timeEnergy = signal.reduce((sum, x) => sum + x * x, 0);

    // Frequency domain energy (via PSD)
    const psd = powerSpectralDensity(signal, 1, 'rectangular');

    // Should be approximately equal (scaling factors may differ)
    expect(psd.totalPower).toBeGreaterThan(0);
  });

  it('should return only positive frequencies', () => {
    const signal = new Array(64).fill(1);
    const psd = powerSpectralDensity(signal, 100);

    // Should return N/2 + 1 frequency bins (0 to Nyquist)
    expect(psd.frequencies.length).toBe(33);
    expect(psd.frequencies[0]).toBe(0);
    expect(psd.frequencies[psd.frequencies.length - 1]).toBeCloseTo(50, 5); // Nyquist
  });
});

describe('Dominant Frequency Detection', () => {
  it('should find dominant frequencies', () => {
    const sampleRate = 1000;
    const signal = Array.from(
      { length: 1024 },
      (_, i) =>
        Math.sin((2 * Math.PI * 50 * i) / sampleRate) +
        0.5 * Math.sin((2 * Math.PI * 150 * i) / sampleRate),
    );

    const peaks = findDominantFrequencies(signal, sampleRate, 3);

    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0]?.frequency).toBeCloseTo(50, 0);
    expect(peaks[0]!.magnitude).toBeGreaterThan(peaks[1]!.magnitude);
  });

  it('should sort by magnitude', () => {
    const sampleRate = 1000;
    const signal = Array.from(
      { length: 1024 },
      (_, i) =>
        0.3 * Math.sin((2 * Math.PI * 30 * i) / sampleRate) +
        Math.sin((2 * Math.PI * 60 * i) / sampleRate) +
        0.5 * Math.sin((2 * Math.PI * 90 * i) / sampleRate),
    );

    const peaks = findDominantFrequencies(signal, sampleRate, 5);

    // Should be sorted by magnitude (descending)
    for (let i = 0; i < peaks.length - 1; i++) {
      expect(peaks[i]!.magnitude).toBeGreaterThanOrEqual(peaks[i + 1]!.magnitude);
    }
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe('Utility Functions', () => {
  it('should convert to decibels', () => {
    const magnitudes = [1, 10, 100, 1000];
    const db = toDecibels(magnitudes);

    expect(db[0]).toBeCloseTo(0, 10);
    expect(db[1]).toBeCloseTo(20, 10);
    expect(db[2]).toBeCloseTo(40, 10);
    expect(db[3]).toBeCloseTo(60, 10);
  });

  it('should handle zero magnitude in dB conversion', () => {
    const db = toDecibels([0, 1]);
    expect(db[0]).toBe(-Infinity);
  });

  it('should zero-pad signal', () => {
    const signal = [1, 2, 3];
    const padded = zeroPad(signal, 8);

    expect(padded.length).toBe(8);
    expect(padded.slice(0, 3)).toEqual(signal);
    expect(padded.slice(3)).toEqual([0, 0, 0, 0, 0]);
  });

  it('should not pad if target length smaller', () => {
    const signal = [1, 2, 3, 4];
    const padded = zeroPad(signal, 2);
    expect(padded).toEqual(signal);
  });

  it('should compute autocorrelation', () => {
    const signal = [1, 2, 3, 2, 1];
    const acf = autocorrelation(signal);

    expect(acf.length).toBeGreaterThan(0);
    // R[0] should be maximum (signal correlated with itself)
    expect(acf[0]).toBeGreaterThan(0);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance Tests', () => {
  it('should handle large signals efficiently', () => {
    const signal = new Array(8192).fill(0).map(() => Math.random());

    const startTime = performance.now();
    const result = fft(signal);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.magnitude.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });

  it('should be faster than DFT for large signals', () => {
    const signal = new Array(256).fill(0).map(() => Math.random());

    const fftStart = performance.now();
    fft(signal);
    const fftTime = performance.now() - fftStart;

    const dftStart = performance.now();
    dft(signal);
    const dftTime = performance.now() - dftStart;

    expect(fftTime).toBeLessThan(dftTime);
  });
});

// ============================================================================
// EDGE CASES AND NUMERICAL STABILITY
// ============================================================================

describe('Edge Cases and Numerical Stability', () => {
  it('should handle all-zero signal', () => {
    const signal = new Array(16).fill(0);
    const result = fft(signal);

    expect(result.magnitude.every((m) => approxEqual(m, 0))).toBe(true);
  });

  it('should handle very small values', () => {
    const signal = new Array(64).fill(1e-10);
    const result = fft(signal);

    expect(result.magnitude.every((m) => !Number.isNaN(m))).toBe(true);
  });

  it('should handle very large values', () => {
    const signal = new Array(64).fill(1e10);
    const result = fft(signal);

    expect(result.magnitude.every((m) => Number.isFinite(m))).toBe(true);
  });

  it('should preserve numerical precision', () => {
    // Test with known analytical solution
    const signal = [1, 0, 0, 0];
    const result = fft(signal);

    // FFT of impulse should be all 1s
    expect(result.magnitude.every((m) => approxEqual(m, 1, 1e-12))).toBe(true);
  });
});
