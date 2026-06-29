/**
 * Strips the leading `/* eslint-disable *\/` banner that @graphql-codegen's
 * client-preset hardcodes into every generated file. This repo lints with Biome
 * (which already ignores **\/generated), so the ESLint banner is dead weight.
 *
 * Wired into codegen.ts via `hooks.afterOneFileWrite` so every regeneration
 * stays Biome-native. graphql-codegen appends the written file path as argv[2].
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) process.exit(0);

const src = readFileSync(file, 'utf8');
const stripped = src.replace(/^\/\* eslint-disable \*\/\r?\n/, '');
if (stripped !== src) writeFileSync(file, stripped);
