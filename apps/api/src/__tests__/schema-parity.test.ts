/**
 * Schema Parity Test
 *
 * The GraphQL schema lives in TWO sources that must stay in lockstep:
 * - src/graphql/schema.ts    — the gql template the server actually executes
 *   (via makeExecutableSchema in server.ts)
 * - src/graphql/schema.graphql — the SDL file consumed by codegen (apps/web
 *   codegen.ts) and external tooling
 *
 * They have already drifted once: `Worksheet.version` was added to
 * schema.graphql but not schema.ts, so codegen-typed subscription documents
 * selecting `version` failed validation against the executable schema. This
 * test kills that drift class by asserting structural parity in BOTH
 * directions: every named type, field, argument (with type modifiers and
 * default values), enum value, union member, custom directive definition,
 * and applied directive (e.g. @cacheControl) must match exactly.
 *
 * Deliberately NOT compared: descriptions and lexical ordering — the two
 * sources are allowed to differ in prose and layout, only shape matters.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildASTSchema,
  buildSchema,
  type ConstDirectiveNode,
  type GraphQLArgument,
  type GraphQLInputField,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  print,
  specifiedDirectives,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import { typeDefs } from '../graphql/schema';

/**
 * Differences that are known, reviewed, and intentional. Every entry MUST be
 * the exact diff string produced below plus an inline rationale comment.
 * Currently empty — the two schema sources are fully identical in shape.
 */
const KNOWN_DIFFERENCES: readonly string[] = [];

/** Built-in directives (@skip, @include, @deprecated, ...) — present in every schema. */
const specifiedDirectiveNames = new Set(specifiedDirectives.map((directive) => directive.name));

/** Printed applied directives (e.g. "@cacheControl(inheritMaxAge: true)"), sorted. */
function appliedDirectives(node: {
  astNode?: { directives?: readonly ConstDirectiveNode[] | undefined } | null | undefined;
  extensionASTNodes?:
    | readonly { directives?: readonly ConstDirectiveNode[] | undefined }[]
    | null
    | undefined;
}): string {
  const nodes = [node.astNode, ...(node.extensionASTNodes ?? [])];
  const printed = nodes
    .flatMap((ast) => ast?.directives ?? [])
    .map((directive) => print(directive))
    .sort();
  return printed.length > 0 ? ` ${printed.join(' ')}` : '';
}

/** Printed default value from the AST ("<none>" when absent). */
function defaultValueOf(field: GraphQLArgument | GraphQLInputField): string {
  return field.astNode?.defaultValue ? print(field.astNode.defaultValue) : '<none>';
}

function kindOf(type: unknown): string {
  if (isObjectType(type)) return 'object';
  if (isInterfaceType(type)) return 'interface';
  if (isInputObjectType(type)) return 'input';
  if (isEnumType(type)) return 'enum';
  if (isUnionType(type)) return 'union';
  if (isScalarType(type)) return 'scalar';
  return 'unknown';
}

/**
 * Flatten a schema into "path -> signature" entries. Two schemas are
 * shape-identical iff their maps are equal, and the map keys give a readable
 * location for every mismatch.
 */
function schemaSignature(schema: GraphQLSchema): Map<string, string> {
  const signature = new Map<string, string>();

  for (const directive of schema.getDirectives()) {
    if (specifiedDirectiveNames.has(directive.name)) continue;
    signature.set(
      `directive @${directive.name}`,
      `on ${[...directive.locations].sort().join(' | ')}`,
    );
    for (const arg of directive.args) {
      signature.set(
        `directive @${directive.name}(${arg.name}:)`,
        `${String(arg.type)} default=${defaultValueOf(arg)}`,
      );
    }
  }

  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith('__') || isSpecifiedScalarType(type)) continue;

    signature.set(type.name, `${kindOf(type)}${appliedDirectives(type)}`);

    if (isObjectType(type) || isInterfaceType(type)) {
      for (const field of Object.values(type.getFields())) {
        signature.set(
          `${type.name}.${field.name}`,
          `${String(field.type)}${appliedDirectives(field)}`,
        );
        for (const arg of field.args) {
          signature.set(
            `${type.name}.${field.name}(${arg.name}:)`,
            `${String(arg.type)} default=${defaultValueOf(arg)}`,
          );
        }
      }
    } else if (isInputObjectType(type)) {
      for (const field of Object.values(type.getFields())) {
        signature.set(
          `${type.name}.${field.name}`,
          `${String(field.type)} default=${defaultValueOf(field)}${appliedDirectives(field)}`,
        );
      }
    } else if (isEnumType(type)) {
      for (const value of type.getValues()) {
        signature.set(`${type.name}.${value.name}`, `enum value${appliedDirectives(value)}`);
      }
    } else if (isUnionType(type)) {
      signature.set(
        `${type.name} =`,
        type
          .getTypes()
          .map((member) => member.name)
          .sort()
          .join(' | '),
      );
    }
  }

  return signature;
}

describe('schema parity: schema.ts (executable) vs schema.graphql (codegen SDL)', () => {
  const sdlPath = fileURLToPath(new URL('../graphql/schema.graphql', import.meta.url));
  const sdlSchema = buildSchema(readFileSync(sdlPath, 'utf8'));
  // Same shape server.ts gets from makeExecutableSchema({ typeDefs }), but
  // built with THIS module's graphql instance — @graphql-tools/schema pulls
  // in a second graphql realm under vitest, and cross-realm type predicates
  // (isScalarType etc.) throw "from another module or realm".
  const executableSchema = buildASTSchema(typeDefs);

  it('has identical types, fields, arguments, and directives in both directions', () => {
    const sdlSignature = schemaSignature(sdlSchema);
    const executableSignature = schemaSignature(executableSchema);

    const diffs: string[] = [];

    for (const [path, sdlShape] of sdlSignature) {
      const executableShape = executableSignature.get(path);
      if (executableShape === undefined) {
        diffs.push(`${path}: in schema.graphql ("${sdlShape}") but missing from schema.ts`);
      } else if (executableShape !== sdlShape) {
        diffs.push(`${path}: schema.graphql has "${sdlShape}", schema.ts has "${executableShape}"`);
      }
    }

    for (const [path, executableShape] of executableSignature) {
      if (!sdlSignature.has(path)) {
        diffs.push(`${path}: in schema.ts ("${executableShape}") but missing from schema.graphql`);
      }
    }

    const unexpected = diffs.filter((diff) => !KNOWN_DIFFERENCES.includes(diff));
    expect(unexpected).toEqual([]);
  });
});
