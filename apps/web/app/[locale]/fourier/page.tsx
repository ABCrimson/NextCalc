'use client';

import { dft, fft } from '@nextcalc/math-engine/fourier';
import { Activity, Clock, Waves, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { FrequencySpectrumRenderer } from '@/components/fourier/frequency-spectrum-renderer';
import { TimeDomainRenderer } from '@/components/fourier/time-domain-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FrequencyData {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
}

interface AlgorithmTiming {
  algorithm: 'fft' | 'dft';
  durationMs: number;
  sampleCount: number;
}

export default function FourierAnalysisPage() {
  const t = useTranslations('fourier');
  const [sampleSize, setSampleSize] = useState<number>(128);
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [algorithm, setAlgorithm] = useState<'fft' | 'dft'>('fft');
  const [signal, setSignal] = useState<number[]>([]);
  const [frequencyData, setFrequencyData] = useState<FrequencyData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [algorithmTiming, setAlgorithmTiming] = useState<AlgorithmTiming | null>(null);
  const [frequency1, setFrequency1] = useState(440); // A4 note
  const [frequency2, setFrequency2] = useState(880); // A5 note
  const [amplitude1, setAmplitude1] = useState(1.0);
  const [amplitude2, setAmplitude2] = useState(0.5);

  // Generate sample signals
  const generateSignal = (
    type: 'sine' | 'square' | 'sawtooth' | 'music' | 'noise',
    algo: 'fft' | 'dft' = algorithm,
  ) => {
    setProcessing(true);
    const samples: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const t = (2 * Math.PI * i) / sampleSize;
      const tSeconds = i / sampleRate;

      switch (type) {
        case 'sine':
          // Dual frequency sine wave
          samples.push(
            amplitude1 * Math.sin(2 * Math.PI * frequency1 * tSeconds) +
              amplitude2 * Math.sin(2 * Math.PI * frequency2 * tSeconds),
          );
          break;
        case 'square':
          // Square wave (sum of odd harmonics)
          samples.push(
            Math.sin(t) + Math.sin(3 * t) / 3 + Math.sin(5 * t) / 5 + Math.sin(7 * t) / 7,
          );
          break;
        case 'sawtooth':
          // Sawtooth wave
          samples.push(2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5)));
          break;
        case 'music':
          // Musical chord (C major triad: C4, E4, G4)
          samples.push(
            0.8 * Math.sin(2 * Math.PI * 261.63 * tSeconds) + // C4
              0.6 * Math.sin(2 * Math.PI * 329.63 * tSeconds) + // E4
              0.5 * Math.sin(2 * Math.PI * 392.0 * tSeconds), // G4
          );
          break;
        case 'noise':
          // White noise with slight bias
          samples.push(Math.random() * 2 - 1);
          break;
        default:
          samples.push(0);
      }
    }

    // Normalize to prevent clipping
    const maxAmp = Math.max(...samples.map(Math.abs));
    if (maxAmp > 0) {
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (samples[i] ?? 0) / maxAmp;
      }
    }

    setSignal(samples);
    analyzeSignal(samples, algo);
    setProcessing(false);
  };

  /**
   * Run either FFT (O(n log n)) or naive DFT (O(n²)) depending on `algo`.
   * The algorithm parameter is explicit so this function is not subject to
   * stale-closure issues when called from useEffect or event handlers.
   */
  const analyzeSignal = (inputSignal: number[], algo: 'fft' | 'dft' = algorithm) => {
    if (inputSignal.length === 0) return;

    try {
      const magnitudes: number[] = [];
      const phases: number[] = [];
      const frequencies: number[] = [];
      const halfLength = Math.floor(inputSignal.length / 2);

      const t0 = performance.now();

      if (algo === 'fft') {
        // Cooley-Tukey FFT — O(n log n)
        const fftResult = fft(inputSignal);
        const transform = fftResult.real.flatMap((r, idx) => [r, fftResult.imag[idx]]);

        for (let i = 0; i < halfLength; i++) {
          const real = transform[i * 2] ?? 0;
          const imag = transform[i * 2 + 1] ?? 0;
          magnitudes.push((Math.sqrt(real * real + imag * imag) / inputSignal.length) * 2);
          phases.push(Math.atan2(imag, real));
          frequencies.push((i * sampleRate) / inputSignal.length);
        }
      } else {
        // Naive DFT — O(n²). Visibly slower for n > ~256.
        const dftResult = dft(inputSignal);

        for (let i = 0; i < halfLength; i++) {
          const bin = dftResult[i];
          if (!bin) continue;
          magnitudes.push(
            (Math.sqrt(bin.real * bin.real + bin.imag * bin.imag) / inputSignal.length) * 2,
          );
          phases.push(Math.atan2(bin.imag, bin.real));
          frequencies.push((i * sampleRate) / inputSignal.length);
        }
      }

      const durationMs = performance.now() - t0;
      setAlgorithmTiming({ algorithm: algo, durationMs, sampleCount: inputSignal.length });
      setFrequencyData({ frequencies, magnitudes, phases });
    } catch (error) {
      console.error('Fourier analysis error:', error);
    }
  };

  const handleCustomSignal = (input: string) => {
    try {
      const values = input
        .split(',')
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v));
      if (values.length > 0) {
        setSignal(values);
        setSampleSize(values.length);
        analyzeSignal(values, algorithm);
      }
    } catch (error) {
      console.error('Invalid input:', error);
    }
  };

  // Generate default signal on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Run once on mount
  useEffect(() => {
    generateSignal('sine', 'fft');
  }, []);

  // Regenerate signal when signal parameters or algorithm selection changes.
  // `algorithm` is included so switching FFT <-> DFT immediately re-runs the analysis.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Regenerate on param changes only
  useEffect(() => {
    if (signal.length > 0) {
      generateSignal('sine', algorithm);
    }
  }, [frequency1, frequency2, amplitude1, amplitude2, sampleSize, sampleRate, algorithm]);

  return (
    <main className="min-h-screen py-12 px-4 bg-gradient-to-br from-background via-background/95 to-background">
      <div className="container mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border border-emerald-500/30">
              <Activity className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {t('title')}
            </h1>
          </div>
          <p className="text-lg text-foreground/80">{t('subtitle')}</p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge
              variant="outline"
              className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
            >
              <Zap className="w-3 h-3 mr-1" />
              GPU Accelerated
            </Badge>
            <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
              60fps Rendering
            </Badge>
            <Badge
              variant="outline"
              className="border-purple-500/50 text-purple-400 bg-purple-500/10"
            >
              FFT O(n log n)
            </Badge>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Control Panel */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-background/90 to-card/90 border-border backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-emerald-400">{t('signalGenerator')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('signalGeneratorDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sample Size Slider */}
              <div className="space-y-2">
                <Label htmlFor="sample-size" className="text-foreground/80">
                  Sample Size: <span className="text-cyan-400 font-mono">{sampleSize}</span>
                </Label>
                <Slider
                  id="sample-size"
                  min={64}
                  max={1024}
                  step={64}
                  value={[sampleSize]}
                  onValueChange={([value]) => setSampleSize(value ?? 128)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground/70">{t('higherValues')}</p>
              </div>

              {/* Sample Rate Slider */}
              <div className="space-y-2">
                <Label htmlFor="sample-rate" className="text-foreground/80">
                  Sample Rate: <span className="text-cyan-400 font-mono">{sampleRate} Hz</span>
                </Label>
                <Slider
                  id="sample-rate"
                  min={8000}
                  max={48000}
                  step={1000}
                  value={[sampleRate]}
                  onValueChange={([value]) => setSampleRate(value ?? 44100)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground/70">
                  Max frequency = {(sampleRate / 2).toLocaleString()} Hz (Nyquist)
                </p>
              </div>

              {/* Frequency Controls */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="text-sm font-semibold text-emerald-400">
                  {t('frequencyComponents')}
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="freq1" className="text-foreground/80">
                    Frequency 1: <span className="text-cyan-400 font-mono">{frequency1} Hz</span>
                  </Label>
                  <Slider
                    id="freq1"
                    min={20}
                    max={2000}
                    step={10}
                    value={[frequency1]}
                    onValueChange={([value]) => setFrequency1(value ?? 440)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amp1" className="text-foreground/80">
                    Amplitude 1:{' '}
                    <span className="text-cyan-400 font-mono">{amplitude1.toFixed(2)}</span>
                  </Label>
                  <Slider
                    id="amp1"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[amplitude1]}
                    onValueChange={([value]) => setAmplitude1(value ?? 1.0)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="freq2" className="text-foreground/80">
                    Frequency 2: <span className="text-cyan-400 font-mono">{frequency2} Hz</span>
                  </Label>
                  <Slider
                    id="freq2"
                    min={20}
                    max={2000}
                    step={10}
                    value={[frequency2]}
                    onValueChange={([value]) => setFrequency2(value ?? 880)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amp2" className="text-foreground/80">
                    Amplitude 2:{' '}
                    <span className="text-cyan-400 font-mono">{amplitude2.toFixed(2)}</span>
                  </Label>
                  <Slider
                    id="amp2"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[amplitude2]}
                    onValueChange={([value]) => setAmplitude2(value ?? 0.5)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Algorithm Selection */}
              <div className="space-y-2">
                <Label className="text-foreground/80">{t('algorithm')}</Label>
                <Tabs value={algorithm} onValueChange={(v) => setAlgorithm(v as 'fft' | 'dft')}>
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                    <TabsTrigger value="fft" className="data-[state=active]:bg-emerald-500/20">
                      {t('fftFast')}
                    </TabsTrigger>
                    <TabsTrigger value="dft" className="data-[state=active]:bg-emerald-500/20">
                      {t('dftNaive')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground/70">{t('algorithmComplexity')}</p>
                {algorithmTiming && (
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-muted/60 border border-border">
                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-xs font-mono text-cyan-300">
                      {algorithmTiming.algorithm.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {algorithmTiming.sampleCount} samples in
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-400">
                      {algorithmTiming.durationMs < 1
                        ? `${(algorithmTiming.durationMs * 1000).toFixed(0)} µs`
                        : `${algorithmTiming.durationMs.toFixed(2)} ms`}
                    </span>
                  </div>
                )}
              </div>

              {/* Preset Signals */}
              <div className="space-y-2">
                <Label className="text-foreground/80">{t('presetSignals')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => generateSignal('sine')}
                    disabled={processing}
                    className="border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    {t('dualSine')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateSignal('square')}
                    disabled={processing}
                    className="border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400"
                  >
                    {t('square')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateSignal('sawtooth')}
                    disabled={processing}
                    className="border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400"
                  >
                    {t('sawtooth')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateSignal('music')}
                    disabled={processing}
                    className="border-purple-500/50 hover:bg-purple-500/10 hover:text-purple-400"
                  >
                    {t('music')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateSignal('noise')}
                    disabled={processing}
                    className="col-span-2 border-pink-500/50 hover:bg-pink-500/10 hover:text-pink-400"
                  >
                    {t('whiteNoise')}
                  </Button>
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-2">
                <Label htmlFor="custom-signal" className="text-foreground/80">
                  {t('customSignal')}
                </Label>
                <Input
                  id="custom-signal"
                  placeholder="1, 2, 3, 4, 5, 4, 3, 2"
                  onBlur={(e) => handleCustomSignal(e.target.value)}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {/* Visualizations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Time Domain Visualization */}
            <Card className="bg-gradient-to-br from-background/90 to-card/90 border-border backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-cyan-400">
                  <Waves className="w-5 h-5" />
                  {t('timeDomainSignal')}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {signal.length} samples @ {sampleRate} Hz • Duration:{' '}
                  {((signal.length / sampleRate) * 1000).toFixed(2)} ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-lg overflow-hidden border border-border">
                  {signal.length > 0 ? (
                    <TimeDomainRenderer signal={signal} sampleRate={sampleRate} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground/70">
                      {t('generateOrInput')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Frequency Domain Results */}
            {frequencyData && (
              <Card className="bg-gradient-to-br from-background/90 to-card/90 border-border backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-400">
                    <Waves className="w-5 h-5" />
                    {t('frequencySpectrum')}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {frequencyData.frequencies.length} frequency bins • Resolution:{' '}
                    {(sampleRate / signal.length).toFixed(2)} Hz/bin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="magnitude" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                      <TabsTrigger
                        value="magnitude"
                        className="data-[state=active]:bg-purple-500/20"
                      >
                        {t('magnitudeSpectrum')}
                      </TabsTrigger>
                      <TabsTrigger value="phase" className="data-[state=active]:bg-purple-500/20">
                        {t('phaseSpectrum')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="magnitude" className="mt-4">
                      <div className="h-[400px] rounded-lg overflow-hidden border border-border">
                        <FrequencySpectrumRenderer
                          frequencies={frequencyData.frequencies}
                          magnitudes={frequencyData.magnitudes}
                          phases={frequencyData.phases}
                          sampleRate={sampleRate}
                          showPhase={false}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="phase" className="mt-4">
                      <div className="h-[400px] rounded-lg overflow-hidden border border-border">
                        <FrequencySpectrumRenderer
                          frequencies={frequencyData.frequencies}
                          magnitudes={frequencyData.phases.map(Math.abs)}
                          phases={frequencyData.phases}
                          sampleRate={sampleRate}
                          showPhase={true}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Educational Content */}
        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">{t('aboutTitle')}</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-emerald-950/40 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/70 transition-all duration-300">
              <h3 className="text-lg font-semibold mb-2 text-emerald-300">{t('fftTitle')}</h3>
              <p className="text-sm text-emerald-200/80">{t('fftAbout')}</p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-purple-950/40 to-purple-900/40 border border-purple-500/40 hover:border-purple-400/70 transition-all duration-300">
              <h3 className="text-lg font-semibold mb-2 text-purple-300">
                {t('applicationsTitle')}
              </h3>
              <p className="text-sm text-purple-200/80">{t('applicationsAbout')}</p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-cyan-950/40 to-cyan-900/40 border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300">
              <h3 className="text-lg font-semibold mb-2 text-cyan-300">
                {t('frequencyResolution')}
              </h3>
              <p className="text-sm text-cyan-200/80">{t('frequencyResolutionAbout')}</p>
            </div>

            <div className="group relative p-6 rounded-lg bg-gradient-to-br from-indigo-950/40 to-indigo-900/40 border border-indigo-500/40 hover:border-indigo-400/70 transition-all duration-300">
              <h3 className="text-lg font-semibold mb-2 text-indigo-300">{t('nyquistTheorem')}</h3>
              <p className="text-sm text-indigo-200/80">{t('nyquistTheoremAbout')}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
