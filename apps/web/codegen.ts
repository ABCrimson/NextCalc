import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../api/src/graphql/schema.graphql',
  documents: ['lib/graphql/**/*.ts', '!lib/graphql/generated/**'],
  generates: {
    './lib/graphql/generated/': {
      preset: 'client',
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
          defaultValue: false,
        },
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, unknown>',
        },
      },
    },
  },
  ignoreNoDocuments: true,
  hooks: {
    // The client preset hardcodes a `/* eslint-disable */` banner into every
    // generated file. This repo lints with Biome (which ignores **/generated),
    // so strip the dead ESLint banner on each write to keep output Biome-native.
    afterOneFileWrite: ['node scripts/codegen-strip-header.mjs'],
  },
};

export default config;
