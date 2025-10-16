# 🎯 NextCalc Pro - Claude Code Quick Start Guide

> **For:** Claude Code Implementation  
> **Prerequisite:** Read `NEXT_GEN_CALCULATOR_SPEC.md` first  
> **Time to MVP:** 2-3 weeks  

---

## 📋 Pre-Implementation Checklist

### Required Tools & Accounts
- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] Vercel account (free tier OK)
- [ ] Cloudflare account (free tier OK)
- [ ] GitHub account
- [ ] PostgreSQL database (Neon/Supabase free tier)

### Environment Setup
```bash
# Verify versions
node --version    # Should be 20+
pnpm --version    # Should be 9+
```

### Get API Tokens
1. **Vercel:** https://vercel.com/account/tokens
2. **Cloudflare:** https://dash.cloudflare.com/profile/api-tokens

---

## 🚀 Phase 0: Immediate Actions (Day 1)

### Step 1: Create Project Repository

```bash
# Create directory
mkdir nextcalc-pro
cd nextcalc-pro

# Initialize git
git init
git branch -M main

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
.next/
out/
dist/
build/
*.tsbuildinfo

# Environment
.env
.env*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Turbo
.turbo/

# WASM build artifacts
*.wasm
*.wasm.map

# Vercel
.vercel/
EOF
```

### Step 2: Initialize Monorepo

```bash
# Initialize pnpm workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "nextcalc-pro",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "turbo": "2.3.3",
    "typescript": "5.9.3"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
EOF

# Install root dependencies
pnpm install
```

### Step 3: Configure Turborepo

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
EOF
```

### Step 4: Configure TypeScript

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@nextcalc/types": ["./packages/types/src"],
      "@nextcalc/math-engine": ["./packages/math-engine/src"],
      "@nextcalc/plot-engine": ["./packages/plot-engine/src"],
      "@nextcalc/ui": ["./packages/ui/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}
EOF
```

### Step 5: Configure Biome

```bash
cat > biome.json << 'EOF'
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noImplicitAnyLet": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
EOF
```

### Step 6: Create Workspace Structure

```bash
# Create directories
mkdir -p apps/web
mkdir -p apps/api
mkdir -p apps/workers
mkdir -p packages/types/src
mkdir -p packages/math-engine/src
mkdir -p packages/plot-engine/src
mkdir -p packages/ui/src
mkdir -p .github/workflows
mkdir -p .mcp

echo "✅ Workspace structure created"
```

### Step 7: Configure MCP Servers

```bash
cat > .mcp/config.json << 'EOF'
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    },
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_ACCOUNT_ID": "${CLOUDFLARE_ACCOUNT_ID}"
      }
    }
  }
}
EOF
```

### Step 8: Create Environment Template

```bash
cat > .env.example << 'EOF'
# Vercel
VERCEL_TOKEN=your_vercel_token_here

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Database (use Neon or Supabase free tier)
DATABASE_URL=postgresql://user:pass@host:5432/nextcalc

# Redis (optional for Phase 1)
REDIS_URL=redis://localhost:6379

# Auth (Clerk - optional for Phase 1)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF

# Copy to actual .env
cp .env.example .env
echo "⚠️  Edit .env and add your actual tokens"
```

---

## 🎨 Phase 1: Frontend Setup (Day 2-3)

### Step 1: Initialize Next.js App

```bash
cd apps/web

# Create Next.js app
pnpx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --turbopack

cd ../..
```

### Step 2: Update Next.js package.json

```bash
cd apps/web

# Update package.json with specific versions
cat > package.json << 'EOF'
{
  "name": "@nextcalc/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest"
  },
  "dependencies": {
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "next": "16.0.0-beta.0",
    "tailwindcss": "4.1.14",
    "@radix-ui/react-dialog": "1.4.3",
    "@radix-ui/react-dropdown-menu": "1.4.3",
    "@radix-ui/react-slot": "1.4.3",
    "@radix-ui/react-tabs": "1.4.3",
    "framer-motion": "12.23.24",
    "katex": "0.16.25",
    "zustand": "5.0.8",
    "@tanstack/react-query": "5.90.3",
    "next-intl": "4.3.12",
    "mathjs": "15.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "@types/katex": "0.16.7",
    "typescript": "5.9.3",
    "@biomejs/biome": "1.9.4",
    "vitest": "3.2.4",
    "@testing-library/react": "^16.1.0",
    "autoprefixer": "^10.4.20"
  }
}
EOF

pnpm install
cd ../..
```

### Step 3: Configure Tailwind CSS

```bash
cd apps/web

cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        calculator: {
          bg: 'hsl(var(--calculator-bg))',
          display: 'hsl(var(--calculator-display))',
          button: 'hsl(var(--calculator-button))',
          operator: 'hsl(var(--calculator-operator))',
          equals: 'hsl(var(--calculator-equals))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
        math: ['KaTeX_Math', 'Computer Modern', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
EOF

cd ../..
```

### Step 4: Create Global Styles

```bash
cd apps/web

cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --calculator-bg: 0 0% 98%;
    --calculator-display: 0 0% 100%;
    --calculator-button: 0 0% 96%;
    --calculator-operator: 221 83% 53%;
    --calculator-equals: 142 76% 36%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --calculator-bg: 222.2 84% 6%;
    --calculator-display: 222.2 84% 8%;
    --calculator-button: 217.2 32.6% 17.5%;
    --calculator-operator: 221 83% 53%;
    --calculator-equals: 142 76% 36%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* KaTeX CSS */
@import 'katex/dist/katex.min.css';
EOF

cd ../..
```

### Step 5: Create Shared Types Package

```bash
cd packages/types

cat > package.json << 'EOF'
{
  "name": "@nextcalc/types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "biome check .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "typescript": "5.9.3"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

pnpm install
cd ../..
```

### Step 6: Define Core Types

```bash
cd packages/types/src

cat > index.ts << 'EOF'
// Core math types
export * from './math';
export * from './calculator';
export * from './plot';

// UI types
export * from './ui';

// API types
export * from './api';
EOF

cat > math.ts << 'EOF'
/**
 * Core mathematical types for NextCalc Pro
 * Uses TypeScript 5.9.3 features: branded types, discriminated unions
 */

// Branded types for dimensional safety
export type Radians = number & { readonly __brand: 'Radians' };
export type Degrees = number & { readonly __brand: 'Degrees' };
export type Meters = number & { readonly __brand: 'Meters' };
export type Seconds = number & { readonly __brand: 'Seconds' };

// Expression AST
export type ExpressionNode =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'variable'; readonly name: string }
  | { readonly type: 'operator'; readonly op: Operator; readonly args: readonly ExpressionNode[] }
  | { readonly type: 'function'; readonly name: string; readonly args: readonly ExpressionNode[] };

export type Operator = '+' | '-' | '*' | '/' | '^' | '%';

// Math expression
export interface MathExpression {
  readonly type: 'expression';
  readonly ast: ExpressionNode;
  readonly raw: string;
}

// Computation modes
export type ComputeMode = 'exact' | 'approximate';

// Result type (no exceptions)
export type Result<T, E = Error> =
  | { readonly type: 'success'; readonly value: T }
  | { readonly type: 'error'; readonly error: E };

// Unit system
export interface Unit<T extends string = string> {
  readonly symbol: string;
  readonly name: string;
  readonly dimension: T;
  readonly toBase: (value: number) => number;
  readonly fromBase: (value: number) => number;
}

export interface Quantity<T extends string = string> {
  readonly value: number;
  readonly unit: Unit<T>;
  readonly dimension: T;
}

// WASM module interface
export interface MathEngineModule {
  readonly add: (a: string, b: string) => string;
  readonly multiply: (a: string, b: string) => string;
  readonly divide: (a: string, b: string) => string;
  readonly power: (base: string, exp: string) => string;
  readonly sqrt: (value: string) => string;
  readonly sin: (value: string) => string;
  readonly cos: (value: string) => string;
  readonly tan: (value: string) => string;
}

// Web Worker messages
export interface ComputeRequest {
  readonly id: string;
  readonly expression: string;
  readonly mode: ComputeMode;
  readonly precision?: number;
}

export interface ComputeResponse {
  readonly id: string;
  readonly type: 'success' | 'error';
  readonly result?: number | string;
  readonly error?: string;
}
EOF

cat > calculator.ts << 'EOF'
/**
 * Calculator state and actions
 */

// Calculator state
export interface CalculatorState {
  readonly current: string;
  readonly result: number | string | null;
  readonly history: readonly HistoryEntry[];
  readonly mode: 'exact' | 'approximate';
}

export interface HistoryEntry {
  readonly id: string;
  readonly expression: string;
  readonly result: number | string;
  readonly timestamp: Date;
}

// Calculator actions (discriminated union)
export type CalculatorAction =
  | { readonly type: 'KEY_PRESS'; readonly payload: string }
  | { readonly type: 'BUTTON_CLICK'; readonly payload: string }
  | { readonly type: 'CLEAR' }
  | { readonly type: 'EVALUATE' }
  | { readonly type: 'SET_MODE'; readonly payload: 'exact' | 'approximate' }
  | { readonly type: 'LOAD_HISTORY'; readonly payload: HistoryEntry };
EOF

cat > plot.ts << 'EOF'
/**
 * Plotting and visualization types
 */

// Plot configuration
export type PlotType = '2d' | '3d' | 'parametric' | 'polar';

export interface PlotConfig {
  readonly type: PlotType;
  readonly functions: readonly PlotFunction[];
  readonly viewport: Viewport;
  readonly style: PlotStyle;
}

export interface PlotFunction {
  readonly expression: string;
  readonly color: string;
  readonly label?: string;
}

export interface Viewport {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin?: number;
  readonly zMax?: number;
}

export interface PlotStyle {
  readonly lineWidth: number;
  readonly showGrid: boolean;
  readonly showAxes: boolean;
  readonly backgroundColor: string;
}

// Plot data
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Point3D extends Point2D {
  readonly z: number;
}

// Sampling configuration
export interface SamplingConfig {
  readonly xMin: number;
  readonly xMax: number;
  readonly tolerance: number;
  readonly maxDepth: number;
}
EOF

cat > ui.ts << 'EOF'
/**
 * UI component types
 */

// Theme
export type Theme = 'light' | 'dark' | 'high-contrast';

// Keyboard shortcuts
export interface KeyboardShortcut {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly action: string;
}

// Component props
export interface ButtonProps {
  readonly variant?: 'default' | 'operator' | 'equals' | 'clear';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children: React.ReactNode;
}
EOF

cat > api.ts << 'EOF'
/**
 * API and backend types
 */

// User
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: Date;
}

// Worksheet
export interface Worksheet {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly content: WorksheetContent;
  readonly isPublic: boolean;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorksheetContent {
  readonly cells: readonly WorksheetCell[];
}

export interface WorksheetCell {
  readonly id: string;
  readonly type: 'expression' | 'markdown' | 'plot';
  readonly content: string;
  readonly result?: string;
}

// Forum
export interface ForumPost {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly upvotes: number;
  readonly userId: string;
  readonly createdAt: Date;
}
EOF

cd ../../..
```

---

## 🧮 Phase 1: Build Calculator Component (Day 4-5)

### Step 1: Install shadcn/ui Components

```bash
cd apps/web

# Initialize shadcn/ui (uses latest CLI version)
pnpx shadcn@latest init -y

# Add components (shadcn copies components into your project)
pnpx shadcn@latest add button
pnpx shadcn@latest add input
pnpx shadcn@latest add card
pnpx shadcn@latest add tabs
pnpx shadcn@latest add scroll-area

cd ../..
```

**Note:** shadcn/ui is NOT a package you install. It's a CLI tool that copies pre-built, customizable components into your `components/ui` directory. The components use Radix UI primitives and Tailwind CSS.

### Step 2: Create Calculator Store (Zustand)

```bash
cd apps/web

mkdir -p lib/stores

cat > lib/stores/calculator-store.ts << 'EOF'
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CalculatorState, CalculatorAction, HistoryEntry } from '@nextcalc/types';
import { evaluate } from 'mathjs';

interface CalculatorStore {
  state: CalculatorState;
  dispatch: (action: CalculatorAction) => void;
}

const initialState: CalculatorState = {
  current: '',
  result: null,
  history: [],
  mode: 'approximate',
};

function calculateNextState(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case 'KEY_PRESS':
    case 'BUTTON_CLICK': {
      const key = action.payload;

      if (key === 'Enter' || key === '=') {
        return evaluateExpression(state);
      }

      if (key === 'Backspace') {
        return { ...state, current: state.current.slice(0, -1) };
      }

      if (key === 'Escape') {
        return { ...state, current: '', result: null };
      }

      return { ...state, current: state.current + key };
    }

    case 'CLEAR':
      return { ...state, current: '', result: null };

    case 'EVALUATE':
      return evaluateExpression(state);

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'LOAD_HISTORY':
      return {
        ...state,
        current: action.payload.expression,
        result: action.payload.result,
      };

    default:
      return state;
  }
}

function evaluateExpression(state: CalculatorState): CalculatorState {
  try {
    const result = evaluate(state.current);
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      expression: state.current,
      result: String(result),
      timestamp: new Date(),
    };

    return {
      ...state,
      result,
      history: [entry, ...state.history].slice(0, 100), // Keep last 100
    };
  } catch (error) {
    return {
      ...state,
      result: 'Error',
    };
  }
}

export const useCalculatorStore = create<CalculatorStore>()(
  devtools(
    persist(
      (set) => ({
        state: initialState,
        dispatch: (action) => {
          set((store) => ({
            state: calculateNextState(store.state, action),
          }));
        },
      }),
      {
        name: 'calculator-storage',
        partialize: (state) => ({ history: state.state.history }),
      },
    ),
  ),
);
EOF

cd ../..
```

### Step 3: Create Calculator Components

```bash
cd apps/web

mkdir -p components/calculator

# Display component
cat > components/calculator/display.tsx << 'EOF'
'use client';

import { Card } from '@/components/ui/card';

interface DisplayProps {
  expression: string;
  result: number | string | null;
}

export function Display({ expression, result }: DisplayProps) {
  return (
    <Card className="p-4 bg-calculator-display">
      <div className="text-right space-y-2">
        <div className="text-sm text-muted-foreground font-mono min-h-6">
          {expression || '\u00A0'}
        </div>
        <div className="text-3xl font-bold font-mono min-h-12">
          {result !== null ? String(result) : '\u00A0'}
        </div>
      </div>
    </Card>
  );
}
EOF

# Keyboard component
cat > components/calculator/keyboard.tsx << 'EOF'
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { CalculatorAction } from '@nextcalc/types';

interface KeyboardProps {
  onInput: (action: CalculatorAction) => void;
}

const KEYBOARD_LAYOUT = [
  ['sin', 'cos', 'tan', '(', ')'],
  ['7', '8', '9', '/', 'sqrt'],
  ['4', '5', '6', '*', '^'],
  ['1', '2', '3', '-', 'π'],
  ['0', '.', '=', '+', 'C'],
] as const;

export function Keyboard({ onInput }: KeyboardProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't interfere with normal typing in inputs
      if (event.target instanceof HTMLInputElement) return;

      const key = event.key;

      // Map keyboard keys to calculator inputs
      if (/^[0-9+\-*/().^]$/.test(key) || key === 'Enter' || key === 'Escape' || key === 'Backspace') {
        event.preventDefault();
        onInput({ type: 'KEY_PRESS', payload: key });
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onInput]);

  const handleButtonClick = (value: string) => {
    if (value === '=') {
      onInput({ type: 'EVALUATE' });
    } else if (value === 'C') {
      onInput({ type: 'CLEAR' });
    } else if (value === 'π') {
      onInput({ type: 'BUTTON_CLICK', payload: 'pi' });
    } else {
      onInput({ type: 'BUTTON_CLICK', payload: value });
    }
  };

  return (
    <div className="grid grid-cols-5 gap-2" role="grid" aria-label="Calculator keyboard">
      {KEYBOARD_LAYOUT.map((row, rowIdx) => (
        <div key={rowIdx} className="contents">
          {row.map((key) => (
            <Button
              key={key}
              onClick={() => handleButtonClick(key)}
              variant={
                key === '=' ? 'default' :
                ['+', '-', '*', '/', '^'].includes(key) ? 'secondary' :
                key === 'C' ? 'destructive' :
                'outline'
              }
              className="aspect-square text-lg font-semibold"
              aria-label={`Input ${key}`}
            >
              {key}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
EOF

# History component
cat > components/calculator/history.tsx << 'EOF'
'use client';

import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HistoryEntry } from '@nextcalc/types';

interface HistoryProps {
  entries: readonly HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
}

export function History({ entries, onSelect }: HistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">History</h3>
      <ScrollArea className="h-48">
        <div className="space-y-2">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect?.(entry)}
              className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
            >
              <div className="text-sm font-mono text-muted-foreground">
                {entry.expression}
              </div>
              <div className="text-base font-mono font-semibold">
                = {entry.result}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
EOF

# Main calculator component
cat > components/calculator/calculator.tsx << 'EOF'
'use client';

import { useCalculatorStore } from '@/lib/stores/calculator-store';
import { Display } from './display';
import { Keyboard } from './keyboard';
import { History } from './history';
import type { CalculatorAction } from '@nextcalc/types';

export function Calculator() {
  const { state, dispatch } = useCalculatorStore();

  const handleInput = (action: CalculatorAction) => {
    dispatch(action);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <Display expression={state.current} result={state.result} />
      <Keyboard onInput={handleInput} />
      <History
        entries={state.history}
        onSelect={(entry) => dispatch({ type: 'LOAD_HISTORY', payload: entry })}
      />
    </div>
  );
}
EOF

cd ../..
```

### Step 4: Create Main Page

```bash
cd apps/web

cat > app/page.tsx << 'EOF'
import { Calculator } from '@/components/calculator/calculator';

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">NextCalc Pro</h1>
          <p className="text-muted-foreground">
            Modern scientific calculator powered by React 19 + Next.js 16 beta
          </p>
        </header>

        <Calculator />
      </div>
    </main>
  );
}
EOF

cd ../..
```

### Step 5: Run Development Server

```bash
cd apps/web
pnpm dev
```

**Open browser:** http://localhost:3000

You should now have a working calculator! 🎉

---

## 📊 Phase 2: Add KaTeX Rendering (Day 6)

### Step 1: Create LaTeX Renderer

```bash
cd apps/web

cat > components/math/latex-renderer.tsx << 'EOF'
'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';

interface LaTeXRendererProps {
  expression: string;
  displayMode?: boolean;
  className?: string;
}

export function LaTeXRenderer({
  expression,
  displayMode = false,
  className = '',
}: LaTeXRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(expression, containerRef.current, {
          displayMode,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: 'warn',
          trust: false,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
      }
    }
  }, [expression, displayMode]);

  return (
    <div
      ref={containerRef}
      className={`katex-container ${className}`}
      role="math"
      aria-label={`Math expression: ${expression}`}
    />
  );
}
EOF

cd ../..
```

### Step 2: Update Display to Show LaTeX

```bash
cd apps/web

cat > components/calculator/display.tsx << 'EOF'
'use client';

import { Card } from '@/components/ui/card';
import { LaTeXRenderer } from '@/components/math/latex-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DisplayProps {
  expression: string;
  result: number | string | null;
}

function convertToLatex(expr: string): string {
  // Simple conversions
  return expr
    .replace(/\*/g, '\\cdot ')
    .replace(/\^/g, '^')
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/pi/g, '\\pi')
    .replace(/sin\((.*?)\)/g, '\\sin($1)')
    .replace(/cos\((.*?)\)/g, '\\cos($1)')
    .replace(/tan\((.*?)\)/g, '\\tan($1)');
}

export function Display({ expression, result }: DisplayProps) {
  const latex = convertToLatex(expression);

  return (
    <Card className="p-4 bg-calculator-display">
      <Tabs defaultValue="plain">
        <TabsList className="mb-4">
          <TabsTrigger value="plain">Plain</TabsTrigger>
          <TabsTrigger value="latex">LaTeX</TabsTrigger>
        </TabsList>

        <TabsContent value="plain">
          <div className="text-right space-y-2">
            <div className="text-sm text-muted-foreground font-mono min-h-6">
              {expression || '\u00A0'}
            </div>
            <div className="text-3xl font-bold font-mono min-h-12">
              {result !== null ? String(result) : '\u00A0'}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="latex">
          <div className="text-right space-y-2">
            {expression && (
              <LaTeXRenderer
                expression={latex}
                displayMode={true}
                className="text-sm"
              />
            )}
            {result !== null && (
              <div className="text-3xl font-bold font-mono">
                = {String(result)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
EOF

cd ../..
```

---

## 🚢 Deployment (Day 7)

### Step 1: Deploy to Vercel (Using Vercel MCP)

```bash
# From project root
cd apps/web

# Login to Vercel (if not already)
pnpx vercel login

# Deploy
pnpx vercel --prod

cd ../..
```

**Alternative:** Use Vercel MCP server to deploy programmatically.

### Step 2: Configure Environment Variables

In Vercel dashboard:
1. Go to Project Settings
2. Add environment variables from `.env`
3. Redeploy

---

## ✅ MVP Checklist

After completing these steps, you should have:

- [x] Monorepo with Turborepo
- [x] TypeScript 5.9.3 strict mode
- [x] Next.js 16.0.0-beta.0 with App Router
- [x] React 19.2.0
- [x] Tailwind CSS 4.1.14
- [x] Calculator UI with Radix components
- [x] Math.js expression evaluation
- [x] KaTeX LaTeX rendering
- [x] Zustand state management
- [x] Calculation history
- [x] Keyboard input support
- [x] Dark/light theme
- [x] Deployed to Vercel

---

## 🔜 Next Steps (Week 2+)

### Phase 2: Math Engine (WASM)
1. Set up Emscripten toolchain
2. Compile MPFR/GMP to WASM
3. Create TypeScript bindings
4. Implement Web Worker isolation
5. Add arbitrary precision support

### Phase 3: Advanced Visualization
1. Install Three.js
2. Create WebGL renderer
3. Implement 2D/3D plotting
4. Add interactive controls

### Phase 4: Backend & Database
1. Set up Prisma + PostgreSQL
2. Build GraphQL API
3. Implement authentication
4. Create worksheet system
5. Add forum/Q&A

### Phase 5: Cloudflare Integration
1. Deploy Workers microservices
2. Configure R2 storage
3. Set up D1 caching
4. Add rate limiting with KV

---

## 🆘 Troubleshooting

### Common Issues

**TypeScript errors:**
```bash
# Clear build cache
pnpm clean
rm -rf node_modules .next
pnpm install
```

**Tailwind not working:**
```bash
# Rebuild Tailwind config
cd apps/web
pnpm build
```

**WASM build fails:**
```bash
# Install Emscripten
brew install emscripten  # macOS
# or
sudo apt-get install emscripten  # Linux
```

**Vercel deployment fails:**
```bash
# Check build logs
pnpx vercel logs

# Test build locally
pnpm build
```

---

## 📚 Resources

- [Next.js 16 beta Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [TypeScript 5.9 Release Notes](https://devblogs.microsoft.com/typescript/)
- [Turborepo Handbook](https://turbo.build/repo/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Cloudflare Developers](https://developers.cloudflare.com)

---

## 🎯 Success Indicators

### Week 1 (MVP)
- ✅ Calculator works in browser
- ✅ Keyboard input functional
- ✅ Math.js evaluates expressions
- ✅ KaTeX renders LaTeX
- ✅ History persists locally
- ✅ Deployed to Vercel

### Week 2 (Enhanced)
- ⏳ WASM engine integrated
- ⏳ Arbitrary precision working
- ⏳ Web Workers isolate compute
- ⏳ Unit conversion functional

### Week 3 (Visualization)
- ⏳ 2D plots render
- ⏳ Interactive controls work
- ⏳ 3D plots with Three.js
- ⏳ Adaptive sampling implemented

### Week 4 (Backend)
- ⏳ Database schema deployed
- ⏳ GraphQL API functional
- ⏳ User authentication works
- ⏳ Worksheets save/load

---

**End of Quick Start Guide**

Follow this guide step-by-step. Each command should work as-is. Good luck! 🚀
