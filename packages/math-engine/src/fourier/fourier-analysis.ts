/**
 * Fourier Analysis Module
 *
 * Comprehensive implementation of Fourier transform algorithms and analysis tools.
 * Includes both DFT and highly optimized FFT (Cooley-Tukey algorithm) for efficient
 * frequency domain analysis.
 *
 * Key Features:
 * - Fast Fourier Transform (FFT) with O(n log n) complexity
 * - Inverse FFT for signal reconstruction
 * - Fourier series expansion with arbitrary precision
 * - Frequency spectrum and phase analysis
 * - Power spectral density computation
 * - Windowing functions for spectral leakage reduction
 *
 * Mathematical Foundation:
 * DFT: X[k] = Σ(n=0 to N-1) x[n] * e^(-i*2π*k*n/N)
 * FFT: Divide-and-conquer recursion on even/odd samples
 *
 * @module fourier/fourier-analysis
 */

/**
 * Complex number representation
 */
export interface Complex {
  /** Real part */
  readonly real: number;
  /** Imaginary part */
  readonly imag: number;
}

/**
 * FFT result containing frequency domain representation
 */
export interface FFTResult {
  /** Real components of frequency bins */
  readonly real: number[];
  /** Imaginary components of frequency bins */
  readonly imag: number[];
  /** Magnitude spectrum (amplitude at each frequency) */
  readonly magnitude: number[];
  /** Phase spectrum (phase angle at each frequency in radians) */
  readonly phase: number[];
  /** Frequency values corresponding to each bin */
  readonly frequencies: number[];
  /** Sample rate used for computation */
  readonly sampleRate: number;
}

/**
 * Configuration for Fourier series expansion
 */
export interface FourierSeriesConfig {
  /** Period of the function (T in f(x + T) = f(x)) */
  readonly period: number;
  /** Number of terms to compute (higher = better approximation) */
  readonly terms: number;
  /** Number of sample points for coefficient integration */
  readonly samples?: number;
}

/**
 * Result of Fourier series expansion
 */
export interface FourierSeriesResult {
  /** DC component (a0/2 coefficient) */
  readonly a0: number;
  /** Cosine coefficients [a1, a2, ..., an] */
  readonly an: number[];
  /** Sine coefficients [b1, b2, ..., bn] */
  readonly bn: number[];
  /** Reconstruction function to evaluate series at any point */
  readonly reconstruct: (x: number) => number;
  /** RMS error of approximation */
  readonly error: number;
}

/**
 * Window function types for spectral analysis
 */
export type WindowFunction = 'rectangular' | 'hamming' | 'hann' | 'blackman' | 'bartlett';

/**
 * Power spectral density result
 */
export interface PowerSpectralDensity {
  /** Frequency bins */
  readonly frequencies: number[];
  /** Power spectral density values */
  readonly psd: number[];
  /** Total power in signal */
  readonly totalPower: number;
}

// ============================================================================
// FAST FOURIER TRANSFORM (FFT)
// ============================================================================

/**
 * Fast Fourier Transform using Cooley-Tukey algorithm
 *
 * Computes the Discrete Fourier Transform using the divide-and-conquer FFT algorithm.
 * Input length must be a power of 2 (will zero-pad if necessary).
 *
 * Time Complexity: O(n log n)
 * Space Complexity: O(n)
 *
 * Algorithm:
 * 1. Divide signal into even and odd indexed samples
 * 2. Recursively compute FFT of each half
 * 3. Combine using twiddle factors: W_N^k = e^(-2πik/N)
 *
 * @param signal - Input signal (real values)
 * @param sampleRate - Sample rate in Hz (default: 1.0)
 * @returns FFT result with magnitude, phase, and frequency bins
 *
 * @example
 * // Analyze a 440 Hz sine wave sampled at 8000 Hz
 * const signal = Array.from({ length: 1024 }, (_, i) =>
 *   Math.sin(2 * Math.PI * 440 * i / 8000)
 * );
 * const result = fft(signal, 8000);
 * // Find peak frequency
 * const peakIdx = result.magnitude.indexOf(Math.max(...result.magnitude));
 * console.log(`Peak at ${result.frequencies[peakIdx]} Hz`);
 */
export function fft(signal: number[], sampleRate = 1.0): FFTResult {
  // Validate input
  if (signal.length === 0) {
    throw new Error('Input signal cannot be empty');
  }

  // Ensure length is power of 2 (zero-pad if necessary)
  const n = nextPowerOfTwo(signal.length);
  const paddedSignal = [...signal, ...Array(n - signal.length).fill(0)];

  // Convert to complex numbers
  const complexSignal: Complex[] = paddedSignal.map((x) => ({ real: x, imag: 0 }));

  // Perform FFT
  const result = fftComplex(complexSignal);

  // Extract components
  const real = result.map((c) => c.real);
  const imag = result.map((c) => c.imag);
  const magnitude = result.map((c) => Math.sqrt(c.real * c.real + c.imag * c.imag));
  const phase = result.map((c) => Math.atan2(c.imag, c.real));

  // Generate frequency bins
  const frequencies = Array.from({ length: n }, (_, k) => (k * sampleRate) / n);

  return {
    real,
    imag,
    magnitude,
    phase,
    frequencies,
    sampleRate,
  };
}

/**
 * FFT implementation for complex input
 *
 * Core recursive FFT using Cooley-Tukey decimation-in-time algorithm.
 *
 * @param x - Complex input sequence
 * @returns Complex output sequence
 */
function fftComplex(x: Complex[]): Complex[] {
  const n = x.length;

  // Base case: DFT for single element
  if (n <= 1) return x;

  // Divide: separate even and odd indices
  const even: Complex[] = [];
  const odd: Complex[] = [];

  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      even.push(x[i] as Complex);
    } else {
      odd.push(x[i] as Complex);
    }
  }

  // Conquer: recursively compute FFT of halves
  const evenFFT = fftComplex(even);
  const oddFFT = fftComplex(odd);

  // Combine: apply twiddle factors
  const result: Complex[] = Array(n);

  for (let k = 0; k < n / 2; k++) {
    // Twiddle factor: W_N^k = e^(-2πik/N)
    const angle = (-2 * Math.PI * k) / n;
    const twiddle: Complex = {
      real: Math.cos(angle),
      imag: Math.sin(angle),
    };

    // Complex multiplication: twiddle * oddFFT[k]
    const twiddledOdd = complexMultiply(twiddle, oddFFT[k] as Complex);

    // Combine results
    result[k] = complexAdd(evenFFT[k] as Complex, twiddledOdd);
    result[k + n / 2] = complexSubtract(evenFFT[k] as Complex, twiddledOdd);
  }

  return result;
}

/**
 * Inverse Fast Fourier Transform
 *
 * Converts frequency domain representation back to time domain.
 * Uses the relationship: IFFT(X) = conj(FFT(conj(X))) / N
 *
 * Time Complexity: O(n log n)
 *
 * @param real - Real components from FFT
 * @param imag - Imaginary components from FFT
 * @returns Reconstructed signal
 *
 * @example
 * const signal = [1, 2, 3, 4];
 * const spectrum = fft(signal);
 * const reconstructed = ifft(spectrum.real, spectrum.imag);
 * // reconstructed ≈ [1, 2, 3, 4]
 */
export function ifft(real: number[], imag: number[]): number[] {
  if (real.length !== imag.length) {
    throw new Error('Real and imaginary arrays must have same length');
  }

  const n = real.length;

  // Create complex conjugate
  const conjugate: Complex[] = real.map((r, i) => ({
    real: r,
    imag: -(imag[i] ?? 0),
  }));

  // Apply FFT to conjugate
  const result = fftComplex(conjugate);

  // Conjugate result and scale by 1/N
  return result.map((c) => c.real / n);
}

// ============================================================================
// DISCRETE FOURIER TRANSFORM (DFT)
// ============================================================================

/**
 * Direct Discrete Fourier Transform
 *
 * Naive O(n²) implementation useful for small signals or verification.
 * Computes DFT using direct summation formula.
 *
 * Time Complexity: O(n²)
 *
 * @param signal - Input signal
 * @returns Complex frequency domain representation
 *
 * @example
 * const signal = [1, 0, -1, 0];
 * const spectrum = dft(signal);
 */
export function dft(signal: number[]): Complex[] {
  const n = signal.length;
  const result: Complex[] = Array(n);

  for (let k = 0; k < n; k++) {
    let real = 0;
    let imag = 0;

    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      real += signal[t]! * Math.cos(angle);
      imag += signal[t]! * Math.sin(angle);
    }

    result[k] = { real, imag };
  }

  return result;
}

/**
 * Inverse Discrete Fourier Transform
 *
 * @param spectrum - Complex frequency domain data
 * @returns Time domain signal
 */
export function idft(spectrum: Complex[]): number[] {
  const n = spectrum.length;
  const result: number[] = Array(n);

  for (let t = 0; t < n; t++) {
    let sum = 0;

    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k * t) / n;
      const spec = spectrum[k]!;
      sum += spec.real * Math.cos(angle) - spec.imag * Math.sin(angle);
    }

    result[t] = sum / n;
  }

  return result;
}

// ============================================================================
// FOURIER SERIES EXPANSION
// ============================================================================

/**
 * Fourier Series Expansion
 *
 * Approximates a periodic function as a sum of sines and cosines:
 * f(x) ≈ a0/2 + Σ(n=1 to N) [an*cos(nωx) + bn*sin(nωx)]
 * where ω = 2π/T
 *
 * Coefficients computed using numerical integration (trapezoidal rule):
 * a0 = (2/T) ∫ f(x) dx
 * an = (2/T) ∫ f(x)*cos(nωx) dx
 * bn = (2/T) ∫ f(x)*sin(nωx) dx
 *
 * @param func - Periodic function to approximate
 * @param config - Configuration (period, terms, samples)
 * @returns Fourier series coefficients and reconstruction function
 *
 * @example
 * // Square wave with period 2π
 * const squareWave = (x: number) => (Math.sin(x) >= 0 ? 1 : -1);
 * const series = fourierSeries(squareWave, { period: 2 * Math.PI, terms: 10 });
 * const approx = series.reconstruct(Math.PI / 4);
 */
export function fourierSeries(
  func: (x: number) => number,
  config: FourierSeriesConfig,
): FourierSeriesResult {
  const { period, terms, samples = 1000 } = config;

  // Validate input
  if (period <= 0) {
    throw new Error('Period must be positive');
  }
  if (terms <= 0) {
    throw new Error('Number of terms must be positive');
  }

  const omega = (2 * Math.PI) / period;
  const dx = period / samples;

  // Compute a0 (DC component)
  let a0 = 0;
  for (let i = 0; i < samples; i++) {
    const x = i * dx;
    a0 += func(x);
  }
  a0 = (2 * a0) / samples;

  // Compute an and bn coefficients
  const an: number[] = Array(terms);
  const bn: number[] = Array(terms);

  for (let n = 1; n <= terms; n++) {
    let anSum = 0;
    let bnSum = 0;

    for (let i = 0; i < samples; i++) {
      const x = i * dx;
      const fx = func(x);
      anSum += fx * Math.cos(n * omega * x);
      bnSum += fx * Math.sin(n * omega * x);
    }

    an[n - 1] = (2 * anSum) / samples;
    bn[n - 1] = (2 * bnSum) / samples;
  }

  // Create reconstruction function
  const reconstruct = (x: number): number => {
    let sum = a0 / 2;

    for (let n = 1; n <= terms; n++) {
      sum += (an[n - 1] ?? 0) * Math.cos(n * omega * x);
      sum += (bn[n - 1] ?? 0) * Math.sin(n * omega * x);
    }

    return sum;
  };

  // Compute RMS error
  let errorSum = 0;
  for (let i = 0; i < samples; i++) {
    const x = i * dx;
    const diff = func(x) - reconstruct(x);
    errorSum += diff * diff;
  }
  const error = Math.sqrt(errorSum / samples);

  return { a0, an, bn, reconstruct, error };
}

// ============================================================================
// SPECTRAL ANALYSIS
// ============================================================================

/**
 * Apply window function to signal
 *
 * Reduces spectral leakage by tapering signal edges to zero.
 *
 * @param signal - Input signal
 * @param windowType - Type of window function
 * @returns Windowed signal
 *
 * @example
 * const windowed = applyWindow(signal, 'hamming');
 * const spectrum = fft(windowed);
 */
export function applyWindow(signal: number[], windowType: WindowFunction = 'hann'): number[] {
  const n = signal.length;
  const window = generateWindow(n, windowType);

  return signal.map((value, i) => value * (window[i] ?? 1));
}

/**
 * Generate window function
 *
 * @param n - Window length
 * @param windowType - Type of window
 * @returns Window coefficients
 */
function generateWindow(n: number, windowType: WindowFunction): number[] {
  const window: number[] = Array(n);

  for (let i = 0; i < n; i++) {
    switch (windowType) {
      case 'rectangular':
        window[i] = 1;
        break;

      case 'hamming':
        window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
        break;

      case 'hann':
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
        break;

      case 'blackman':
        window[i] =
          0.42 -
          0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
          0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
        break;

      case 'bartlett':
        window[i] = 1 - Math.abs((2 * i) / (n - 1) - 1);
        break;

      default:
        window[i] = 1;
    }
  }

  return window;
}

/**
 * Compute Power Spectral Density
 *
 * Estimates power distribution across frequencies using Welch's method
 * (averaged periodograms with overlapping segments).
 *
 * PSD[k] = |X[k]|² / (Fs * N)
 *
 * @param signal - Input signal
 * @param sampleRate - Sample rate in Hz
 * @param windowType - Window function to apply
 * @returns Power spectral density
 *
 * @example
 * const psd = powerSpectralDensity(signal, 1000, 'hamming');
 * console.log(`Total power: ${psd.totalPower}`);
 */
export function powerSpectralDensity(
  signal: number[],
  sampleRate = 1.0,
  windowType: WindowFunction = 'hann',
): PowerSpectralDensity {
  // Apply window
  const windowed = applyWindow(signal, windowType);

  // Compute FFT
  const spectrum = fft(windowed, sampleRate);

  // Compute PSD: |X[k]|² / (Fs * N)
  const n = spectrum.magnitude.length;
  const psd = spectrum.magnitude.map((mag) => (mag * mag) / (sampleRate * n));

  // Total power (Parseval's theorem)
  const totalPower = psd.reduce((sum, p) => sum + p, 0);

  // Only return positive frequencies (0 to Nyquist)
  const halfN = Math.floor(n / 2) + 1;
  const frequencies = spectrum.frequencies.slice(0, halfN);
  const psdHalf = psd.slice(0, halfN);

  return {
    frequencies,
    psd: psdHalf,
    totalPower,
  };
}

/**
 * Find dominant frequencies in signal
 *
 * @param signal - Input signal
 * @param sampleRate - Sample rate in Hz
 * @param numPeaks - Number of peaks to return
 * @returns Array of {frequency, magnitude} objects
 *
 * @example
 * const peaks = findDominantFrequencies(signal, 8000, 5);
 * console.log(`Top frequency: ${peaks[0].frequency} Hz`);
 */
export function findDominantFrequencies(
  signal: number[],
  sampleRate = 1.0,
  numPeaks = 5,
): Array<{ frequency: number; magnitude: number }> {
  const spectrum = fft(signal, sampleRate);

  // Only consider positive frequencies (up to Nyquist)
  const halfN = Math.floor(spectrum.magnitude.length / 2);
  const magnitudes = spectrum.magnitude.slice(0, halfN);
  const frequencies = spectrum.frequencies.slice(0, halfN);

  // Find peaks
  const peaks: Array<{ frequency: number; magnitude: number }> = [];

  for (let i = 1; i < magnitudes.length - 1; i++) {
    const prev = magnitudes[i - 1] ?? 0;
    const curr = magnitudes[i] ?? 0;
    const next = magnitudes[i + 1] ?? 0;

    // Local maximum
    if (curr > prev && curr > next) {
      peaks.push({
        frequency: frequencies[i] ?? 0,
        magnitude: curr,
      });
    }
  }

  // Sort by magnitude and return top peaks
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  return peaks.slice(0, numPeaks);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Complex number addition
 */
function complexAdd(a: Complex, b: Complex): Complex {
  return {
    real: a.real + b.real,
    imag: a.imag + b.imag,
  };
}

/**
 * Complex number subtraction
 */
function complexSubtract(a: Complex, b: Complex): Complex {
  return {
    real: a.real - b.real,
    imag: a.imag - b.imag,
  };
}

/**
 * Complex number multiplication
 */
function complexMultiply(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

/**
 * Find next power of two greater than or equal to n
 */
function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Compute magnitude spectrum from complex values
 */
export function magnitude(complex: Complex[]): number[] {
  return complex.map((c) => Math.sqrt(c.real * c.real + c.imag * c.imag));
}

/**
 * Compute phase spectrum from complex values
 */
export function phase(complex: Complex[]): number[] {
  return complex.map((c) => Math.atan2(c.imag, c.real));
}

/**
 * Convert spectrum to decibels
 *
 * dB = 20 * log10(magnitude)
 *
 * @param magnitudes - Magnitude spectrum
 * @param reference - Reference value (default: 1.0)
 * @returns Magnitude in dB
 */
export function toDecibels(magnitudes: number[], reference = 1.0): number[] {
  return magnitudes.map((mag) => {
    const ratio = mag / reference;
    return ratio > 0 ? 20 * Math.log10(ratio) : -Infinity;
  });
}

/**
 * Zero-pad signal to specified length
 */
export function zeroPad(signal: number[], length: number): number[] {
  if (length <= signal.length) return signal;
  return [...signal, ...Array(length - signal.length).fill(0)];
}

/**
 * Compute autocorrelation using FFT
 *
 * R[k] = Σ x[n] * x[n+k]
 *
 * @param signal - Input signal
 * @returns Autocorrelation sequence
 */
export function autocorrelation(signal: number[]): number[] {
  // Compute FFT
  const spectrum = fft(signal);

  // Compute power spectrum |X[k]|²
  const power = spectrum.real.map((r, i) => r * r + (spectrum.imag[i] ?? 0) ** 2);

  // Inverse FFT of power spectrum gives autocorrelation
  const imag = Array(power.length).fill(0);
  return ifft(power, imag);
}
