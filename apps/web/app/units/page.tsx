import type { Metadata } from 'next';
import { UnitConverter } from '@/components/calculator/unit-converter';

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
    colorClasses: 'from-blue-950/40 to-blue-900/40 border-blue-500/40 hover:border-blue-400/70 shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]',
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
    colorClasses: 'from-emerald-950/40 to-emerald-900/40 border-emerald-500/40 hover:border-emerald-400/70 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]',
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
    colorClasses: 'from-rose-950/40 to-rose-900/40 border-rose-500/40 hover:border-rose-400/70 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_25px_rgba(244,63,94,0.35)]',
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
    colorClasses: 'from-cyan-950/40 to-cyan-900/40 border-cyan-500/40 hover:border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)]',
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
    colorClasses: 'from-amber-950/40 to-amber-900/40 border-amber-500/40 hover:border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]',
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
    colorClasses: 'from-orange-950/40 to-orange-900/40 border-orange-500/40 hover:border-orange-400/70 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_25px_rgba(249,115,22,0.35)]',
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
    colorClasses: 'from-purple-950/40 to-purple-900/40 border-purple-500/40 hover:border-purple-400/70 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.35)]',
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
    colorClasses: 'from-indigo-950/40 to-indigo-900/40 border-indigo-500/40 hover:border-indigo-400/70 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.35)]',
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
    colorClasses: 'from-sky-950/40 to-sky-900/40 border-sky-500/40 hover:border-sky-400/70 shadow-[0_0_15px_rgba(14,165,233,0.2)] hover:shadow-[0_0_25px_rgba(14,165,233,0.35)]',
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
    colorClasses: 'from-yellow-950/40 to-yellow-900/40 border-yellow-500/40 hover:border-yellow-400/70 shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.35)]',
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
    colorClasses: 'from-red-950/40 to-red-900/40 border-red-500/40 hover:border-red-400/70 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.35)]',
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
    colorClasses: 'from-teal-950/40 to-teal-900/40 border-teal-500/40 hover:border-teal-400/70 shadow-[0_0_15px_rgba(20,184,166,0.2)] hover:shadow-[0_0_25px_rgba(20,184,166,0.35)]',
    headingClasses: 'text-teal-300',
    textClasses: 'text-teal-200/80',
    countClasses: 'text-teal-300/60',
  },
];

const EXAMPLE_CONVERSIONS = [
  { accent: 'text-blue-400',   category: 'Length',      text: '1 kilometer = 0.621 371 miles = 3 280.84 feet' },
  { accent: 'text-blue-400',   category: 'Length',      text: '1 inch = 2.54 cm (exact)' },
  { accent: 'text-emerald-400',category: 'Mass',        text: '1 kilogram = 2.204 62 pounds' },
  { accent: 'text-emerald-400',category: 'Mass',        text: '1 stone = 14 pounds = 6.350 29 kg' },
  { accent: 'text-rose-400',   category: 'Temperature', text: '0 °C = 32 °F = 273.15 K' },
  { accent: 'text-cyan-400',   category: 'Volume',      text: '1 US gallon = 3.785 41 liters' },
  { accent: 'text-amber-400',  category: 'Area',        text: '1 hectare = 10 000 m² = 2.471 acres' },
  { accent: 'text-orange-400', category: 'Speed',       text: '1 knot = 1.852 km/h = 1 nautical mile/h' },
  { accent: 'text-purple-400', category: 'Time',        text: '1 year ≈ 365.2425 days = 31 556 952 seconds' },
  { accent: 'text-indigo-400', category: 'Data',        text: '1 GiB = 1 073 741 824 bytes ≠ 1 GB (1 000 000 000 bytes)' },
  { accent: 'text-sky-400',    category: 'Pressure',    text: '1 atm = 101 325 Pa = 14.696 psi = 760 mmHg' },
  { accent: 'text-yellow-400', category: 'Energy',      text: '1 kcal = 4 184 J (food "Calorie")' },
  { accent: 'text-red-400',    category: 'Force',       text: '1 lbf = 4.448 22 N' },
  { accent: 'text-teal-400',   category: 'Angle',       text: '1 radian = 180/π ≈ 57.296°' },
];

export default function UnitsPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Unit Converter</h1>
          <p className="text-lg text-muted-foreground">
            Convert between 80+ units across 12 measurement categories with high-precision,
            SI-based calculations.
          </p>
        </header>

        {/* Interactive converter */}
        <UnitConverter />

        {/* Category grid */}
        <section className="mt-12 space-y-6" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-2xl font-semibold">
            Supported Categories
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {CATEGORY_CARDS.map((card) => (
              <div
                key={card.label}
                className={`group relative p-5 rounded-lg bg-gradient-to-br ${card.colorClasses} border transition-all duration-300`}
              >
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <h3 className={`text-base font-semibold mb-1 flex items-center gap-2 ${card.headingClasses}`}>
                    <span className="text-xl w-7 h-7 flex items-center justify-center shrink-0" aria-hidden="true">{card.icon}</span>
                    {card.label}
                  </h3>
                  <p className={`text-xs mb-2 ${card.textClasses}`}>{card.description}</p>
                  <p className={`text-xs font-mono ${card.countClasses}`}>{card.exampleUnits}</p>
                  <p className={`text-xs mt-1 ${card.countClasses}`}>{card.unitCount} units</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Example conversions */}
        <section className="mt-12 space-y-4" aria-labelledby="examples-heading">
          <h2 id="examples-heading" className="text-2xl font-semibold">
            Example Conversions
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_CONVERSIONS.map(({ accent, category, text }) => (
              <div
                key={text}
                className="p-3 rounded-lg bg-gradient-to-br from-background/80 to-card/80 border border-border shadow-sm"
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
        <section className="mt-12" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-semibold mb-4">Features</h2>
          <div className="group relative p-6 rounded-lg bg-gradient-to-br from-indigo-950/40 to-indigo-900/40 border border-indigo-500/40 hover:border-indigo-400/70 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.35)]">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <ul className="relative space-y-2">
              {[
                ['Live Conversion', 'Results update automatically as you type'],
                ['12 Categories', '80+ units covering all common measurement needs'],
                ['Conversion Formula', 'See the exact factor or formula used for each conversion'],
                ['Searchable Units', 'Filter units by name, symbol, or abbreviation'],
                ['Recent History', 'Quickly re-apply previous conversions'],
                ['Swap Button', 'Reverse the conversion direction instantly'],
                ['High Precision', 'SI-based conversions with up to 10 significant figures'],
                ['Accessible', 'Full keyboard navigation and screen reader support (WCAG 2.2 AAA)'],
              ].map(([title, detail]) => (
                <li key={title} className="text-sm text-indigo-200/90">
                  <strong className="text-indigo-300">{title}: </strong>
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
