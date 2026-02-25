import type { Config } from 'tailwindcss';

// Tailwind CSS 4.x configuration - CSS-first approach
// Theme is defined in globals.css using @theme directive
const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
} satisfies Config;

export default config;
