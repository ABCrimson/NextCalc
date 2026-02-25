# Fourier Analysis Module - Usage Examples

## Table of Contents
1. [Fast Fourier Transform (FFT)](#fast-fourier-transform)
2. [Spectral Analysis](#spectral-analysis)
3. [Fourier Series Expansion](#fourier-series-expansion)
4. [Window Functions](#window-functions)
5. [Advanced Applications](#advanced-applications)

## Fast Fourier Transform

### Basic FFT Usage

```typescript
import { fft, ifft } from '@nextcalc/math-engine/fourier';

// Analyze a 440 Hz sine wave (musical note A4)
const sampleRate = 8000; // Hz
const duration = 1; // second
const frequency = 440; // Hz

const signal = Array.from(
  { length: sampleRate * duration },
  (_, i) => Math.sin(2 * Math.PI * frequency * i / sampleRate)
);

const spectrum = fft(signal, sampleRate);

// Find dominant frequency
const maxIdx = spectrum.magnitude.indexOf(Math.max(...spectrum.magnitude));
console.log(`Peak frequency: ${spectrum.frequencies[maxIdx]} Hz`);
// Output: Peak frequency: 440 Hz
```

### Signal Reconstruction

```typescript
import { fft, ifft } from '@nextcalc/math-engine/fourier';

const original = [1, 2, 3, 4, 5, 6, 7, 8];

// Transform to frequency domain
const spectrum = fft(original);

// Reconstruct from frequency domain
const reconstructed = ifft(spectrum.real, spectrum.imag);

console.log('Original:', original);
console.log('Reconstructed:', reconstructed);
// Should be nearly identical (within floating-point precision)
```

### Multi-Frequency Signal Analysis

```typescript
import { fft, findDominantFrequencies } from '@nextcalc/math-engine/fourier';

const sampleRate = 1000;
const samples = 1024;

// Create signal with multiple frequency components
const signal = Array.from({ length: samples }, (_, i) => {
  const t = i / sampleRate;
  return (
    Math.sin(2 * Math.PI * 50 * t) +      // 50 Hz
    0.5 * Math.sin(2 * Math.PI * 120 * t) + // 120 Hz
    0.3 * Math.sin(2 * Math.PI * 200 * t)   // 200 Hz
  );
});

const peaks = findDominantFrequencies(signal, sampleRate, 5);

peaks.forEach((peak, i) => {
  console.log(`Peak ${i + 1}: ${peak.frequency.toFixed(1)} Hz, magnitude: ${peak.magnitude.toFixed(2)}`);
});

// Output:
// Peak 1: 50.0 Hz, magnitude: 512.00
// Peak 2: 120.0 Hz, magnitude: 256.00
// Peak 3: 200.0 Hz, magnitude: 153.60
```

## Spectral Analysis

### Power Spectral Density

```typescript
import { powerSpectralDensity, toDecibels } from '@nextcalc/math-engine/fourier';

const signal = generateNoiseSignal(1024);
const psd = powerSpectralDensity(signal, 1000, 'hann');

// Convert to dB scale
const psdDB = toDecibels(psd.psd);

console.log(`Total power: ${psd.totalPower.toFixed(2)}`);
console.log(`Frequency resolution: ${psd.frequencies[1] - psd.frequencies[0]} Hz`);

// Plot PSD
psd.frequencies.forEach((freq, i) => {
  console.log(`${freq.toFixed(1)} Hz: ${psdDB[i]?.toFixed(1)} dB`);
});
```

### Autocorrelation for Periodicity Detection

```typescript
import { autocorrelation } from '@nextcalc/math-engine/fourier';

// Signal with hidden periodicity
const signal = Array.from({ length: 100 }, (_, i) =>
  Math.sin(2 * Math.PI * i / 10) + 0.5 * Math.random()
);

const acf = autocorrelation(signal);

// Find peaks in autocorrelation (indicates period)
let maxAcf = -Infinity;
let period = 0;

for (let lag = 1; lag < acf.length / 2; lag++) {
  if (acf[lag]! > maxAcf) {
    maxAcf = acf[lag]!;
    period = lag;
  }
}

console.log(`Detected period: ${period} samples`);
// Output: Detected period: 10 samples
```

## Fourier Series Expansion

### Approximating Square Wave

```typescript
import { fourierSeries } from '@nextcalc/math-engine/fourier';

// Define square wave function
const squareWave = (x: number) => Math.sin(x) >= 0 ? 1 : -1;

// Compute Fourier series with 50 terms
const series = fourierSeries(squareWave, {
  period: 2 * Math.PI,
  terms: 50,
  samples: 1000,
});

console.log('Fourier Coefficients:');
console.log(`a0: ${series.a0.toFixed(4)}`);
console.log(`a1: ${series.an[0]?.toFixed(4)}`);
console.log(`b1: ${series.bn[0]?.toFixed(4)}`);
console.log(`RMS Error: ${series.error.toFixed(6)}`);

// Evaluate approximation at various points
for (let x = 0; x <= 2 * Math.PI; x += Math.PI / 4) {
  const exact = squareWave(x);
  const approx = series.reconstruct(x);
  console.log(`x=${x.toFixed(2)}: exact=${exact}, approx=${approx.toFixed(4)}`);
}
```

### Sawtooth Wave Approximation

```typescript
import { fourierSeries } from '@nextcalc/math-engine/fourier';

const sawtooth = (x: number) => {
  const normalized = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return normalized / Math.PI - 1;
};

const series = fourierSeries(sawtooth, {
  period: 2 * Math.PI,
  terms: 20,
});

// Compare with different numbers of terms
for (const numTerms of [5, 10, 20, 50]) {
  const s = fourierSeries(sawtooth, {
    period: 2 * Math.PI,
    terms: numTerms,
  });
  console.log(`${numTerms} terms: RMS error = ${s.error.toFixed(6)}`);
}
```

### Custom Periodic Function

```typescript
import { fourierSeries } from '@nextcalc/math-engine/fourier';

// Define custom periodic function
const customFunc = (x: number) => {
  const t = x % (2 * Math.PI);
  if (t < Math.PI) return t * t;
  return (2 * Math.PI - t) * (2 * Math.PI - t);
};

const series = fourierSeries(customFunc, {
  period: 2 * Math.PI,
  terms: 30,
  samples: 2000,
});

// Use reconstruction to evaluate anywhere
const testPoints = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
testPoints.forEach(x => {
  console.log(`f(${x.toFixed(2)}) ≈ ${series.reconstruct(x).toFixed(4)}`);
});
```

## Window Functions

### Comparing Window Effects

```typescript
import { applyWindow, fft, type WindowFunction } from '@nextcalc/math-engine/fourier';

// Non-integer frequency (causes spectral leakage)
const sampleRate = 1000;
const signal = Array.from({ length: 1024 }, (_, i) =>
  Math.sin(2 * Math.PI * 10.5 * i / sampleRate)
);

const windows: WindowFunction[] = ['rectangular', 'hamming', 'hann', 'blackman', 'bartlett'];

windows.forEach(windowType => {
  const windowed = applyWindow(signal, windowType);
  const spectrum = fft(windowed, sampleRate);

  // Measure spectral leakage (energy outside main lobe)
  const mainLobeBins = 3;
  const peakIdx = spectrum.magnitude.indexOf(Math.max(...spectrum.magnitude));
  const mainLobeEnergy = spectrum.magnitude
    .slice(Math.max(0, peakIdx - mainLobeBins), peakIdx + mainLobeBins + 1)
    .reduce((sum, m) => sum + m * m, 0);
  const totalEnergy = spectrum.magnitude.reduce((sum, m) => sum + m * m, 0);
  const leakage = 1 - mainLobeEnergy / totalEnergy;

  console.log(`${windowType}: ${(leakage * 100).toFixed(2)}% spectral leakage`);
});
```

### Optimal Window Selection

```typescript
import { applyWindow, fft } from '@nextcalc/math-engine/fourier';

function selectWindow(signalType: 'transient' | 'continuous' | 'narrowband') {
  switch (signalType) {
    case 'transient':
      return 'rectangular'; // Best time localization
    case 'continuous':
      return 'hann'; // Good general-purpose
    case 'narrowband':
      return 'blackman'; // Best frequency resolution
  }
}

const signal = generateSignal();
const window = selectWindow('continuous');
const windowed = applyWindow(signal, window);
const spectrum = fft(windowed);
```

## Advanced Applications

### Audio Frequency Analysis

```typescript
import { fft, powerSpectralDensity, findDominantFrequencies } from '@nextcalc/math-engine/fourier';

function analyzeAudio(samples: number[], sampleRate: number) {
  // Compute FFT
  const spectrum = fft(samples, sampleRate);

  // Find dominant frequencies (musical notes)
  const peaks = findDominantFrequencies(samples, sampleRate, 10);

  // Compute power spectral density
  const psd = powerSpectralDensity(samples, sampleRate, 'hann');

  // Identify frequency ranges
  const bass = psd.psd.filter((_, i) => psd.frequencies[i]! < 250).reduce((a, b) => a + b, 0);
  const mid = psd.psd.filter((_, i) => {
    const f = psd.frequencies[i]!;
    return f >= 250 && f < 4000;
  }).reduce((a, b) => a + b, 0);
  const treble = psd.psd.filter((_, i) => psd.frequencies[i]! >= 4000).reduce((a, b) => a + b, 0);

  return {
    peaks,
    totalPower: psd.totalPower,
    bassEnergy: bass,
    midEnergy: mid,
    trebleEnergy: treble,
  };
}

// Example usage
const audioSamples = loadAudioFile('sample.wav');
const analysis = analyzeAudio(audioSamples, 44100);

console.log('Dominant frequencies:', analysis.peaks.map(p => `${p.frequency.toFixed(1)} Hz`));
console.log(`Bass: ${(100 * analysis.bassEnergy / analysis.totalPower).toFixed(1)}%`);
console.log(`Mid: ${(100 * analysis.midEnergy / analysis.totalPower).toFixed(1)}%`);
console.log(`Treble: ${(100 * analysis.trebleEnergy / analysis.totalPower).toFixed(1)}%`);
```

### Vibration Analysis

```typescript
import { fft, powerSpectralDensity } from '@nextcalc/math-engine/fourier';

function detectMachineVibration(accelerometerData: number[], sampleRate: number) {
  const psd = powerSpectralDensity(accelerometerData, sampleRate, 'hann');

  // Look for peaks indicating mechanical issues
  const rotationalFrequencies = [10, 20, 30, 40, 50]; // Hz
  const tolerance = 0.5; // Hz

  const anomalies: Array<{ frequency: number; power: number }> = [];

  rotationalFrequencies.forEach(targetFreq => {
    const idx = psd.frequencies.findIndex(f => Math.abs(f - targetFreq) < tolerance);
    if (idx !== -1 && psd.psd[idx]! > threshold) {
      anomalies.push({
        frequency: psd.frequencies[idx]!,
        power: psd.psd[idx]!,
      });
    }
  });

  return {
    isHealthy: anomalies.length === 0,
    anomalies,
    rms: Math.sqrt(psd.totalPower),
  };
}
```

### Signal Filtering in Frequency Domain

```typescript
import { fft, ifft } from '@nextcalc/math-engine/fourier';

function lowPassFilter(signal: number[], cutoffFreq: number, sampleRate: number) {
  // Transform to frequency domain
  const spectrum = fft(signal, sampleRate);

  // Apply filter
  const filtered = spectrum.real.map((real, i) => {
    const freq = spectrum.frequencies[i]!;
    const attenuation = freq > cutoffFreq ? 0 : 1;
    return real * attenuation;
  });

  const filteredImag = spectrum.imag.map((imag, i) => {
    const freq = spectrum.frequencies[i]!;
    const attenuation = freq > cutoffFreq ? 0 : 1;
    return imag * attenuation;
  });

  // Transform back to time domain
  return ifft(filtered, filteredImag);
}

// Remove high-frequency noise
const noisySignal = generateNoisySignal();
const cleanSignal = lowPassFilter(noisySignal, 100, 1000);
```

## Performance Benchmarks

```typescript
import { fft, dft } from '@nextcalc/math-engine/fourier';

function benchmarkFFT() {
  const sizes = [64, 128, 256, 512, 1024, 2048, 4096, 8192];

  console.log('FFT Performance Benchmarks:');
  console.log('Size\tFFT (ms)\tDFT (ms)\tSpeedup');

  sizes.forEach(n => {
    const signal = Array.from({ length: n }, () => Math.random());

    // Benchmark FFT
    const fftStart = performance.now();
    fft(signal);
    const fftTime = performance.now() - fftStart;

    // Benchmark DFT (only for smaller sizes)
    let dftTime = 0;
    if (n <= 512) {
      const dftStart = performance.now();
      dft(signal);
      dftTime = performance.now() - dftStart;
    }

    const speedup = dftTime > 0 ? dftTime / fftTime : 0;
    console.log(`${n}\t${fftTime.toFixed(2)}\t${dftTime.toFixed(2)}\t${speedup.toFixed(1)}x`);
  });
}

benchmarkFFT();
```

## Error Handling

```typescript
import { fft, fourierSeries } from '@nextcalc/math-engine/fourier';

try {
  // Empty signal
  const result = fft([]);
} catch (error) {
  console.error('Error:', error.message);
  // Output: Error: Input signal cannot be empty
}

try {
  // Invalid Fourier series config
  fourierSeries(x => x, { period: -1, terms: 10 });
} catch (error) {
  console.error('Error:', error.message);
  // Output: Error: Period must be positive
}

try {
  // Mismatched IFFT arrays
  ifft([1, 2, 3], [1, 2]);
} catch (error) {
  console.error('Error:', error.message);
  // Output: Error: Real and imaginary arrays must have same length
}
```
