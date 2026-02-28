'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wind, Zap, GitBranch } from 'lucide-react';
import { LorenzAttractor, LogisticMap } from '@nextcalc/math-engine/chaos/chaos-theory';
import { Lorenz3DRenderer } from '@/components/chaos/lorenz-3d-renderer';
import { LogisticMapRenderer } from '@/components/chaos/logistic-map-renderer';
import { BifurcationDiagramRenderer } from '@/components/chaos/bifurcation-diagram-renderer';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Glass-morphism card class applied consistently across all panels. */
const GLASS_CARD =
  'bg-gradient-to-br from-background/60 via-card/50 to-background/60 ' +
  'backdrop-blur-md border border-border ' +
  'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]';

export default function ChaosTheoryPage() {
  const t = useTranslations('chaos');
  // Lorenz parameters
  const [sigma, setSigma] = useState(10);
  const [rho, setRho] = useState(28);
  const [beta, setBeta] = useState(8 / 3);
  const [timeSteps, setTimeSteps] = useState(2000);

  // Logistic map parameters
  const [r, setR] = useState(3.72);
  const [iterations, setIterations] = useState(150);

  const [lorenzData, setLorenzData] = useState<Point3D[]>([]);
  const [logisticData, setLogisticData] = useState<number[]>([]);
  const [bifurcationData, setBifurcationData] = useState<{ r: number; x: number }[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBifurcating, setIsBifurcating] = useState(false);

  // --- Lorenz simulation ---
  const simulateLorenz = () => {
    setIsAnimating(true);
    try {
      const lorenz = new LorenzAttractor(sigma, rho, beta);
      const result = lorenz.simulate(timeSteps, 0.01, { x: 1, y: 1, z: 1 });
      setLorenzData([...result]);
    } catch (err) {
      console.error('Lorenz simulation error:', err);
    } finally {
      setTimeout(() => setIsAnimating(false), 400);
    }
  };

  // --- Logistic map simulation ---
  const simulateLogistic = () => {
    try {
      const logistic = new LogisticMap(r);
      const result = logistic.timeSeries(0.5, iterations, 0);
      setLogisticData([...result]);
    } catch (err) {
      console.error('Logistic map error:', err);
    }
  };

  // --- Bifurcation diagram ---
  const generateBifurcationDiagram = () => {
    setIsBifurcating(true);
    // Use setTimeout so the loading state renders before the heavy computation.
    setTimeout(() => {
      const points: { r: number; x: number }[] = [];
      const rStart = 2.5;
      const rEnd = 4.0;
      const rSteps = 500;   // 500 r-values gives dense coverage
      const burnIn = 500;   // discard transient behaviour
      const plotPoints = 150;

      for (let i = 0; i < rSteps; i++) {
        const rValue = rStart + (i / rSteps) * (rEnd - rStart);
        try {
          const logistic = new LogisticMap(rValue);
          const result = logistic.timeSeries(0.5, burnIn + plotPoints, 0);
          for (let j = burnIn; j < result.length; j++) {
            const xValue = result[j];
            if (xValue !== undefined) {
              points.push({ r: rValue, x: xValue });
            }
          }
        } catch (err) {
          console.error('Bifurcation error at r =', rValue, err);
        }
      }

      setBifurcationData(points);
      setIsBifurcating(false);
    }, 16);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run once on mount
  useEffect(() => {
    simulateLorenz();
    simulateLogistic();
    generateBifurcationDiagram();
  }, []);

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Wind className="w-10 h-10 text-cyan-500" />
            <h1 className="text-4xl font-bold text-foreground">{t('title')}</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
          <div className="flex gap-2 mt-4">
            <Badge variant="outline">{t('lorenz')}</Badge>
            <Badge variant="outline">{t('logistic')}</Badge>
            <Badge variant="outline">{t('bifurcation')}</Badge>
          </div>
        </header>

        <Tabs defaultValue="lorenz" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lorenz">{t('lorenz')}</TabsTrigger>
            <TabsTrigger value="logistic">{t('logistic')}</TabsTrigger>
            <TabsTrigger value="bifurcation">{t('bifurcation')}</TabsTrigger>
          </TabsList>

          {/* ── Lorenz Attractor ── */}
          <TabsContent value="lorenz" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              {/* Controls */}
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('lorenzParameters')}</CardTitle>
                  <CardDescription>
                    {t('lorenzParametersDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="sigma" className="text-foreground">
                      σ (Prandtl number): <span className="text-cyan-400 font-mono">{sigma.toFixed(2)}</span>
                    </Label>
                    <Slider
                      id="sigma"
                      min={0}
                      max={20}
                      step={0.5}
                      value={[sigma]}
                      onValueChange={([value]) => setSigma(value ?? 10)}
                    />
                    <p className="text-xs text-muted-foreground">{t('controlsRotation')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rho" className="text-foreground">
                      ρ ({t('rayleighNumber')}): <span className="text-purple-400 font-mono">{rho.toFixed(2)}</span>
                    </Label>
                    <Slider
                      id="rho"
                      min={0}
                      max={50}
                      step={1}
                      value={[rho]}
                      onValueChange={([value]) => setRho(value ?? 28)}
                    />
                    <p className="text-xs text-muted-foreground">{t('chaosEmerges')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beta" className="text-foreground">
                      β ({t('geometricFactor')}): <span className="text-rose-400 font-mono">{beta.toFixed(2)}</span>
                    </Label>
                    <Slider
                      id="beta"
                      min={0}
                      max={10}
                      step={0.1}
                      value={[beta]}
                      onValueChange={([value]) => setBeta(value ?? 8 / 3)}
                    />
                    <p className="text-xs text-muted-foreground">{t('classicValue')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="steps" className="text-foreground">
                      Time Steps: <span className="text-amber-400 font-mono">{timeSteps.toLocaleString()}</span>
                    </Label>
                    <Slider
                      id="steps"
                      min={100}
                      max={5000}
                      step={100}
                      value={[timeSteps]}
                      onValueChange={([value]) => setTimeSteps(value ?? 2000)}
                    />
                  </div>

                  <Button
                    onClick={simulateLorenz}
                    disabled={isAnimating}
                    className="w-full"
                    size="lg"
                  >
                    {isAnimating ? t('simulating') : t('simulateLorenz')}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSigma(10);
                      setRho(28);
                      setBeta(8 / 3);
                      setTimeout(() => simulateLorenz(), 0);
                    }}
                  >
                    {t('classicParams')}
                  </Button>
                </CardContent>
              </Card>

              {/* Visualization */}
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Zap className="w-5 h-5 text-cyan-400" />
                    {t('trajectory3d')}
                  </CardTitle>
                  <CardDescription>
                    {t('trajectory3dDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[420px] rounded-lg border border-border overflow-hidden bg-[#050912]">
                    {lorenzData.length > 0 ? (
                      <Lorenz3DRenderer data={lorenzData} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        {t('clickSimulate')}
                      </div>
                    )}
                  </div>

                  {lorenzData.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      {(
                        [
                          { label: t('xRange'), color: 'text-cyan-400', key: 'x' },
                          { label: t('yRange'), color: 'text-purple-400', key: 'y' },
                          { label: t('zRange'), color: 'text-rose-400', key: 'z' },
                        ] as const
                      ).map(({ label, color, key }) => (
                        <div
                          key={key}
                          className="p-2 bg-background/50 rounded border border-border"
                        >
                          <div className={`${color} font-semibold`}>{label}</div>
                          <div className="text-muted-foreground font-mono">
                            {Math.min(...lorenzData.map(p => p[key])).toFixed(1)}
                            {' to '}
                            {Math.max(...lorenzData.map(p => p[key])).toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Logistic Map ── */}
          <TabsContent value="logistic" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              {/* Controls */}
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('logisticParams')}</CardTitle>
                  <CardDescription>x(n+1) = r · x(n) · (1 − x(n))</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="r" className="text-foreground">
                      {t('growthRate')}: <span className="text-emerald-400 font-mono">{r.toFixed(3)}</span>
                    </Label>
                    <Slider
                      id="r"
                      min={0}
                      max={4}
                      step={0.01}
                      value={[r]}
                      onValueChange={([value]) => setR(value ?? 3.72)}
                    />
                    <div className="text-xs space-y-0.5 text-muted-foreground">
                      <div>r &lt; 1: {t('extinction')}</div>
                      <div>1 &lt; r &lt; 3: {t('stableFixedPoint')}</div>
                      <div>3 &lt; r &lt; 3.57: {t('periodDoubling')}</div>
                      <div>r &gt; 3.57: {t('chaosRegime')}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iterations" className="text-foreground">
                      {t('iterations')}: <span className="text-sky-400 font-mono">{iterations}</span>
                    </Label>
                    <Slider
                      id="iterations"
                      min={10}
                      max={500}
                      step={10}
                      value={[iterations]}
                      onValueChange={([value]) => setIterations(value ?? 150)}
                    />
                  </div>

                  <Button onClick={simulateLogistic} className="w-full" size="lg">
                    {t('simulateLogistic')}
                  </Button>
                </CardContent>
              </Card>

              {/* Visualization */}
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('timeSeries')}</CardTitle>
                  <CardDescription>
                    {t('timeSeriesDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[420px] rounded-lg border border-border overflow-hidden bg-[#07091a]">
                    {logisticData.length > 0 ? (
                      <LogisticMapRenderer data={logisticData} title="x(n)" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        {t('simulateToSee')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Bifurcation Diagram ── */}
          <TabsContent value="bifurcation" className="space-y-6">
            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <GitBranch className="w-5 h-5 text-emerald-400" />
                  {t('bifurcation')}
                </CardTitle>
                <CardDescription>
                  {t('bifurcationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <Button
                    onClick={generateBifurcationDiagram}
                    variant="outline"
                    disabled={isBifurcating}
                    className="flex-1"
                  >
                    {isBifurcating ? t('computing') : t('regenerate')}
                  </Button>
                </div>

                <div className="h-[560px] rounded-lg border border-border overflow-hidden bg-[#060a18]">
                  {bifurcationData.length > 0 ? (
                    <BifurcationDiagramRenderer data={bifurcationData} enableGPU={true} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      {isBifurcating ? t('computingBifurcation') : t('clickRegenerate')}
                    </div>
                  )}
                </div>

                {bifurcationData.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-background/50 rounded border border-border">
                      <div className="text-emerald-400 font-semibold">{t('totalPoints')}</div>
                      <div className="text-muted-foreground font-mono">
                        {bifurcationData.length.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 bg-background/50 rounded border border-border">
                      <div className="text-cyan-400 font-semibold">{t('rRange')}</div>
                      <div className="text-muted-foreground font-mono">
                        {Math.min(...bifurcationData.map(p => p.r)).toFixed(2)}
                        {' – '}
                        {Math.max(...bifurcationData.map(p => p.r)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Educational Content */}
        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">{t('aboutTitle')}</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="group relative p-6 rounded-xl bg-gradient-to-br from-cyan-950/40 to-cyan-900/30 border border-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-semibold mb-2 text-cyan-300">{t('lorenz')}</h3>
              <p className="text-sm text-cyan-200/75 leading-relaxed">
                {t('lorenzAbout')}
              </p>
            </div>

            <div className="group relative p-6 rounded-xl bg-gradient-to-br from-purple-950/40 to-purple-900/30 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-semibold mb-2 text-purple-300">{t('strangeAttractors')}</h3>
              <p className="text-sm text-purple-200/75 leading-relaxed">
                {t('strangeAttractorsAbout')}
              </p>
            </div>

            <div className="group relative p-6 rounded-xl bg-gradient-to-br from-emerald-950/40 to-emerald-900/30 border border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-semibold mb-2 text-emerald-300">{t('logistic')}</h3>
              <p className="text-sm text-emerald-200/75 leading-relaxed">
                {t('logisticAbout')}
              </p>
            </div>

            <div className="group relative p-6 rounded-xl bg-gradient-to-br from-rose-950/40 to-rose-900/30 border border-rose-500/30 hover:border-rose-400/60 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <h3 className="text-lg font-semibold mb-2 text-rose-300">{t('applicationsTitle')}</h3>
              <p className="text-sm text-rose-200/75 leading-relaxed">
                {t('applicationsAbout')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
