/**
 * Fourier Analysis Performance Benchmarks
 *
 * Run with: tsx src/fourier/benchmark.ts
 */

import { fft, dft, fourierSeries, powerSpectralDensity } from './fourier-analysis';

console.log('='.repeat(70));
console.log('FOURIER ANALYSIS PERFORMANCE BENCHMARKS');
console.log('='.repeat(70));

// Benchmark 1: FFT vs DFT
console.log('\n1. FFT vs DFT Performance Comparison\n');
console.log('Size\t\tFFT (ms)\tDFT (ms)\tSpeedup');
console.log('-'.repeat(60));

const sizes = [64, 128, 256, 512, 1024, 2048, 4096, 8192];

sizes.forEach(n => {
  const signal = Array.from({ length: n }, () => Math.random());

  // Benchmark FFT
  const fftStart = performance.now();
  fft(signal);
  const fftTime = performance.now() - fftStart;

  // Benchmark DFT (only for smaller sizes)
  let dftTime = 0;
  let speedup = 0;

  if (n <= 512) {
    const dftStart = performance.now();
    dft(signal);
    dftTime = performance.now() - dftStart;
    speedup = dftTime / fftTime;
  }

  console.log(`${n}\t\t${fftTime.toFixed(2)}\t\t${dftTime > 0 ? dftTime.toFixed(2) : 'N/A'}\t\t${speedup > 0 ? speedup.toFixed(1) + 'x' : 'N/A'}`);
});

// Benchmark 2: Window Functions
console.log('\n2. Window Function Application Performance\n');
console.log('Size\t\tTime (ms)');
console.log('-'.repeat(40));

const windowSizes = [1024, 4096, 16384, 65536];

windowSizes.forEach(n => {
  const signal = Array.from({ length: n }, () => Math.random());

  const start = performance.now();
  powerSpectralDensity(signal, 1000, 'hann');
  const time = performance.now() - start;

  console.log(`${n}\t\t${time.toFixed(2)}`);
});

// Benchmark 3: Fourier Series Convergence
console.log('\n3. Fourier Series Computation Performance\n');
console.log('Terms\t\tTime (ms)\tRMS Error');
console.log('-'.repeat(50));

const squareWave = (x: number) => Math.sin(x) >= 0 ? 1 : -1;
const termCounts = [10, 20, 50, 100, 200];

termCounts.forEach(terms => {
  const start = performance.now();
  const series = fourierSeries(squareWave, {
    period: 2 * Math.PI,
    terms,
    samples: 1000,
  });
  const time = performance.now() - start;

  console.log(`${terms}\t\t${time.toFixed(2)}\t\t${series.error.toFixed(6)}`);
});

// Benchmark 4: Memory Usage
console.log('\n4. Memory Efficiency\n');

const largeSignal = Array.from({ length: 16384 }, () => Math.random());

const perfWithMemory = performance as unknown as { memory?: { usedJSHeapSize: number } };
const memBefore = perfWithMemory.memory?.usedJSHeapSize || 0;
const result = fft(largeSignal);
const memAfter = perfWithMemory.memory?.usedJSHeapSize || 0;

const memUsed = (memAfter - memBefore) / 1024 / 1024;

console.log(`Signal size: ${largeSignal.length} samples`);
console.log(`Memory used: ${memUsed > 0 ? memUsed.toFixed(2) + ' MB' : 'N/A (browser API not available)'}`);
console.log(`Output arrays: ${result.real.length + result.imag.length + result.magnitude.length + result.phase.length + result.frequencies.length} total elements`);

console.log('\n' + '='.repeat(70));
console.log('BENCHMARKS COMPLETE');
console.log('='.repeat(70));
