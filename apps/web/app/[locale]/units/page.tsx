import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UnitConverter } from '@/components/calculator/unit-converter';
import { UnitsBackground, UnitsCategories } from './units-client';

export const metadata: Metadata = {
  title: 'Unit Converter | NextCalc Pro',
  description:
    'Convert between 80+ units across 12 categories: length, mass, temperature, volume, area, speed, time, data, pressure, energy, force, and angle.',
};

interface CategoryCard {
  icon: string;
  label: string;
  description: string;
  unitCount: number;
  exampleUnits: string;
  colorClasses: string;
  headingClasses: string;
  textClasses: string;
  countClasses: string;
}

const CATEGORY_CARDS: CategoryCard[] = [
  {
    icon: '📏',
    label: 'Length',
    description: 'Linear distance from nanometers to miles',
    unitCount: 11,
    exampleUnits: 'nm, μm, mm, cm, m, km, in, ft, yd, mi, nmi',
    colorClasses:
      'from-blue-950/40 to-blue-900/40 border-blue-500/40 hover:border-blue-400/70 shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]',
    headingClasses: 'text-blue-300',
    textClasses: 'text-blue-200/80',
    countClasses: 'text-blue-300/60',
  },
  {
    icon: '⚖️',
    label: 'Mass',
    description: 'Weight and mass from milligrams to tons',
    unitCount: 8,
    exampleUnits: 'mg, g, kg, t, oz, lb, st, ton',
    colorClasses:
      'from-emerald-950/40 to-emerald-900/40 border-emerald-500/40 hover:border-emerald-400/70 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]',
    headingClasses: 'text-emerald-300',
    textClasses: 'text-emerald-200/80',
    countClasses: 'text-emerald-300/60',
  },
  {
    icon: '🌡️',
    label: 'Temperature',
    description: 'Temperature scales including Rankine',
    unitCount: 4,
    exampleUnits: '°C, °F, K, °R',
    colorClasses:
      'from-rose-950/40 to-rose-900/40 border-rose-500/40 hover:border-rose-400/70 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_25px_rgba(244,63,94,0.35)]',
    headingClasses: 'text-rose-300',
    textClasses: 'text-rose-200/80',
    countClasses: 'text-rose-300/60',
  },
  {
    icon: '🧴',
    label: 'Volume',
    description: 'Liquid and solid volumes',
    unitCount: 9,
    exampleUnits: 'mL, L, m³, fl oz, cup, pt, qt, gal, Imp gal',
    colorClasses:
      'from-cyan-950/40 to-cyan-900/40 border-cyan-500/40 hover:border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)]',
    headingClasses: 'text-cyan-300',
    textClasses: 'text-cyan-200/80',
    countClasses: 'text-cyan-300/60',
  },
  {
    icon: '⬜',
    label: 'Area',
    description: 'Surface area from mm² to square miles',
    unitCount: 10,
    exampleUnits: 'mm², cm², m², km², in², ft², yd², mi², ac, ha',
    colorClasses:
      'from-amber-950/40 to-amber-900/40 border-amber-500/40 hover:border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]',
    headingClasses: 'text-amber-300',
    textClasses: 'text-amber-200/80',
    countClasses: 'text-amber-300/60',
  },
  {
    icon: '🚀',
    label: 'Speed',
    description: 'Velocity from m/s to Mach',
    unitCount: 6,
    exampleUnits: 'm/s, km/h, mph, kn, ft/s, Mach',
    colorClasses:
      'from-orange-950/40 to-orange-900/40 border-orange-500/40 hover:border-orange-400/70 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.35)]',
    headingClasses: 'text-orange-300',
    textClasses: 'text-orange-200/80',
    countClasses: 'text-orange-300/60',
  },
  {
    icon: '⏱️',
    label: 'Time',
    description: 'Duration from milliseconds to years',
    unitCount: 8,
    exampleUnits: 'ms, s, min, h, d, wk, mo, yr',
    colorClasses:
      'from-purple-950/40 to-purple-900/40 border-purple-500/40 hover:border-purple-400/70 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.35)]',
    headingClasses: 'text-purple-300',
    textClasses: 'text-purple-200/80',
    countClasses: 'text-purple-300/60',
  },
  {
    icon: '💾',
    label: 'Data',
    description: 'Digital storage: SI and IEC (binary) prefixes',
    unitCount: 10,
    exampleUnits: 'b, B, KB, MB, GB, TB, PB, KiB, MiB, GiB',
    colorClasses:
      'from-indigo-950/40 to-indigo-900/40 border-indigo-500/40 hover:border-indigo-400/70 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.35)]',
    headingClasses: 'text-indigo-300',
    textClasses: 'text-indigo-200/80',
    countClasses: 'text-indigo-300/60',
  },
  {
    icon: '🔵',
    label: 'Pressure',
    description: 'Fluid and atmospheric pressure',
    unitCount: 8,
    exampleUnits: 'Pa, kPa, MPa, bar, mbar, atm, psi, mmHg',
    colorClasses:
      'from-sky-950/40 to-sky-900/40 border-sky-500/40 hover:border-sky-400/70 shadow-[0_0_15px_rgba(14,165,233,0.2)] hover:shadow-[0_0_25px_rgba(14,165,233,0.35)]',
    headingClasses: 'text-sky-300',
    textClasses: 'text-sky-200/80',
    countClasses: 'text-sky-300/60',
  },
  {
    icon: '⚡',
    label: 'Energy',
    description: 'Work, heat, and electrical energy',
    unitCount: 9,
    exampleUnits: 'J, kJ, cal, kcal, Wh, kWh, eV, BTU, ft·lbf',
    colorClasses:
      'from-yellow-950/40 to-yellow-900/40 border-yellow-500/40 hover:border-yellow-400/70 shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.35)]',
    headingClasses: 'text-yellow-300',
    textClasses: 'text-yellow-200/80',
    countClasses: 'text-yellow-300/60',
  },
  {
    icon: '💪',
    label: 'Force',
    description: 'Mechanical force in SI and imperial',
    unitCount: 6,
    exampleUnits: 'N, kN, dyn, lbf, kgf, ozf',
    colorClasses:
      'from-red-950/40 to-red-900/40 border-red-500/40 hover:border-red-400/70 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.35)]',
    headingClasses: 'text-red-300',
    textClasses: 'text-red-200/80',
    countClasses: 'text-red-300/60',
  },
  {
    icon: '📐',
    label: 'Angle',
    description: 'Angular measurement in all common systems',
    unitCount: 6,
    exampleUnits: '°, rad, grad, arcmin, arcsec, rev',
    colorClasses:
      'from-teal-950/40 to-teal-900/40 border-teal-500/40 hover:border-teal-400/70 shadow-[0_0_15px_rgba(20,184,166,0.2)] hover:shadow-[0_0_25px_rgba(20,184,166,0.35)]',
    headingClasses: 'text-teal-300',
    textClasses: 'text-teal-200/80',
    countClasses: 'text-teal-300/60',
  },
];

const EXAMPLE_CONVERSIONS = [
  { accent: 'text-blue-400',    category: 'Length',      text: '1 kilometer = 0.621 371 miles = 3 280.84 feet' },
  { accent: 'text-blue-400',    category: 'Length',      text: '1 inch = 2.54 cm (exact)' },
  { accent: 'text-emerald-400', category: 'Mass',        text: '1 kilogram = 2.204 62 pounds' },
  { accent: 'text-emerald-400', category: 'Mass',        text: '1 stone = 14 pounds = 6.350 29 kg' },
  { accent: 'text-rose-400',    category: 'Temperature', text: '0 °C = 32 °F = 273.15 K' },
  { accent: 'text-cyan-400',    category: 'Volume',      text: '1 US gallon = 3.785 41 liters' },
  { accent: 'text-amber-400',   category: 'Area',        text: '1 hectare = 10 000 m² = 2.471 acres' },
  { accent: 'text-orange-400',  category: 'Speed',       text: '1 knot = 1.852 km/h = 1 nautical mile/h' },
  { accent: 'text-purple-400',  category: 'Time',        text: '1 year ≈ 365.2425 days = 31 556 952 seconds' },
  { accent: 'text-indigo-400',  category: 'Data',        text: '1 GiB = 1 073 741 824 bytes ≠ 1 GB (1 000 000 000 bytes)' },
  { accent: 'text-sky-400',     category: 'Pressure',    text: '1 atm = 101 325 Pa = 14.696 psi = 760 mmHg' },
  { accent: 'text-yellow-400',  category: 'Energy',      text: '1 kcal = 4 184 J (food "Calorie")' },
  { accent: 'text-red-400',     category: 'Force',       text: '1 lbf = 4.448 22 N' },
  { accent: 'text-teal-400',    category: 'Angle',       text: '1 radian = 180/π ≈ 57.296°' },
];

export default async function UnitsPage() {
  const t = await getTranslations('units');
  return (
    <main className="relative min-h-screen">
      {/* Animated gradient background with floating orbs and noise texture */}
      <UnitsBackground />

      <div className="container mx-auto max-w-4xl py-12 px-4 relative">
        {/* Page header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.65 0.22 230 / 0.20), oklch(0.65 0.18 175 / 0.20))',
                borderColor: 'oklch(0.65 0.22 230 / 0.30)',
              }}
            >
              <span
                className="text-3xl leading-none select-none"
                style={{ color: 'oklch(0.75 0.20 195)' }}
                aria-hidden="true"
              >
                ⇌
              </span>
            </div>

            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                {t('pageTitle')}
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                {t('pageSubtitle')}
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: t('badge.categories'), hue: '230' },
              { label: t('badge.units'), hue: '175' },
              { label: t('badge.precision'), hue: '264' },
              { label: t('badge.accessibility'), hue: '155' },
            ].map(({ label, hue }) => (
              <span
                key={label}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: `oklch(0.65 0.18 ${hue} / 0.10)`,
                  borderColor: `oklch(0.65 0.18 ${hue} / 0.35)`,
                  color: `oklch(0.78 0.18 ${hue})`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* Interactive converter — glass morphism card */}
        <div className="backdrop-blur-md bg-card/50 border border-border rounded-2xl overflow-hidden shadow-[0_0_30px_oklch(0.55_0.27_264_/_0.08)]">
          <UnitConverter />
        </div>

        {/* Category grid */}
        <section className="mt-14 space-y-6" aria-labelledby="categories-heading">
          <h2
            id="categories-heading"
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.65 0.22 230))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('supportedCategories')}
          </h2>

          {/* Staggered animated grid — client component */}
          <UnitsCategories categoryCards={CATEGORY_CARDS} />
        </section>

        {/* Example conversions */}
        <section className="mt-14 space-y-4" aria-labelledby="examples-heading">
          <h2
            id="examples-heading"
            className="text-2xl font-semibold"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.65 0.18 175))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('exampleConversions')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_CONVERSIONS.map(({ accent, category, text }) => (
              <div
                key={text}
                className="p-3 rounded-xl backdrop-blur-md bg-card/50 border border-border shadow-sm hover:border-border/80 transition-colors duration-200"
              >
                <p className="font-mono text-sm text-foreground/80">
                  <span className={`font-semibold ${accent}`}>{category}: </span>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-14" aria-labelledby="features-heading">
          <h2
            id="features-heading"
            className="text-2xl font-semibold mb-6"
            style={{
              background: 'linear-gradient(90deg, oklch(0.85 0.015 250), oklch(0.63 0.20 264))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('featuresTitle')}
          </h2>
          <div
            className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md transition-all duration-300 hover:border-indigo-400/70"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.18 0.03 264 / 0.50), oklch(0.16 0.025 264 / 0.40))',
              borderColor: 'oklch(0.55 0.20 264 / 0.40)',
              boxShadow: '0 0 15px oklch(0.55 0.27 264 / 0.15)',
            }}
          >
            {/* Hover overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.06), transparent)',
              }}
            />
            {/* Corner accent */}
            <div
              className="absolute top-0 right-0 w-28 h-28 rounded-bl-full opacity-20"
              style={{
                background:
                  'radial-gradient(circle at top right, oklch(0.65 0.22 264 / 0.4), transparent)',
              }}
            />
            <ul className="relative space-y-2">
              {[
                [t('feature.liveConversion'),    t('feature.liveConversionDesc')],
                [t('feature.categories'),      t('feature.categoriesDesc')],
                [t('feature.formula'), t('feature.formulaDesc')],
                [t('feature.searchable'),   t('feature.searchableDesc')],
                [t('feature.history'),     t('feature.historyDesc')],
                [t('feature.swap'),        t('feature.swapDesc')],
                [t('feature.highPrecision'),     t('feature.highPrecisionDesc')],
                [t('feature.accessible'),         t('feature.accessibleDesc')],
              ].map(([title, detail]) => (
                <li key={title} className="text-sm" style={{ color: 'oklch(0.75 0.08 264)' }}>
                  <strong style={{ color: 'oklch(0.78 0.18 264)' }}>{title}: </strong>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
