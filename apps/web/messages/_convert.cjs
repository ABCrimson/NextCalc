/**
 * Convert flat dot-separated message keys to nested structure for next-intl.
 * Handles conflicts where a key is both a value AND a parent of other keys
 * by keeping the parent as a leaf and moving children to sibling keys.
 *
 * Example:
 *   "nav.calculator": "Calculator"
 *   "nav.calculator.description": "Scientific calculator"
 * Becomes:
 *   { nav: { calculator: "Calculator", calculatorDescription: "Scientific calculator" } }
 */

const fs = require('fs');
const path = require('path');

const locales = ['en', 'ru', 'es', 'uk', 'de', 'fr', 'ja', 'zh'];

function convertFlatToNested(flat) {
  const keys = Object.keys(flat);

  // Find all conflict keys (key is both a value and a prefix of another key)
  const conflictSet = new Set();
  for (const k of keys) {
    const prefix = k + '.';
    if (keys.some((other) => other.startsWith(prefix))) {
      conflictSet.add(k);
    }
  }

  // Build a new flat map where children of conflict keys are renamed
  const renamed = {};
  for (const [key, value] of Object.entries(flat)) {
    let newKey = key;

    // Check if this key is a child of any conflict key
    for (const conflict of conflictSet) {
      const prefix = conflict + '.';
      if (key.startsWith(prefix) && key !== conflict) {
        // This key is a child of a conflict key
        // e.g., "nav.calculator.description" under conflict "nav.calculator"
        const suffix = key.slice(prefix.length); // "description"
        const parentParts = conflict.split('.');
        const lastParentPart = parentParts[parentParts.length - 1];
        // Capitalize first letter of suffix and append to parent
        const capitalizedSuffix = suffix.charAt(0).toUpperCase() + suffix.slice(1);
        // Build new key: parent path + camelCased child
        const parentPath = parentParts.slice(0, -1).join('.');
        newKey = parentPath
          ? `${parentPath}.${lastParentPart}${capitalizedSuffix}`
          : `${lastParentPart}${capitalizedSuffix}`;
        break;
      }
    }

    renamed[newKey] = value;
  }

  // Now convert the renamed flat keys to nested structure using lodash-like set
  const result = {};
  // Sort by key depth (shallowest first) to ensure parent objects exist
  const sortedEntries = Object.entries(renamed).sort(([a], [b]) => {
    const aDepth = a.split('.').length;
    const bDepth = b.split('.').length;
    return aDepth - bDepth;
  });

  for (const [key, value] of sortedEntries) {
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        current[part] = {};
      } else if (typeof current[part] === 'string') {
        // This shouldn't happen after renaming, but handle gracefully
        console.warn(
          `  WARNING: Overwriting string "${current[part]}" at path "${parts.slice(0, i + 1).join('.')}" with object`,
        );
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    if (typeof current[lastPart] === 'object' && current[lastPart] !== null) {
      console.warn(`  WARNING: Cannot set "${key}" = "${value}" because it's already an object`);
    } else {
      current[lastPart] = value;
    }
  }

  return { nested: result, renamedKeys: getRenamedKeys(flat, renamed) };
}

function getRenamedKeys(original, renamed) {
  const changes = [];
  const origKeys = Object.keys(original);
  const newKeys = Object.keys(renamed);

  for (let i = 0; i < origKeys.length; i++) {
    if (origKeys[i] !== newKeys[i]) {
      changes.push({ from: origKeys[i], to: newKeys[i] });
    }
  }
  return changes;
}

// Process all locale files
let allRenamedKeys = null;

for (const locale of locales) {
  const filePath = path.join(__dirname, `${locale}.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${locale}.json (not found)`);
    continue;
  }

  console.log(`Converting ${locale}.json...`);
  const flat = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { nested, renamedKeys } = convertFlatToNested(flat);

  // Save renamed keys from first locale for component updates
  if (!allRenamedKeys) {
    allRenamedKeys = renamedKeys;
  }

  // Write nested format
  fs.writeFileSync(filePath, JSON.stringify(nested, null, 2) + '\n', 'utf8');
  console.log(`  ✓ Written ${Object.keys(flat).length} keys as nested structure`);
}

// Output renamed keys for component reference updates
if (allRenamedKeys && allRenamedKeys.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Renamed keys (${allRenamedKeys.length} total):`);
  console.log(`${'='.repeat(60)}`);
  for (const { from, to } of allRenamedKeys) {
    console.log(`  "${from}" → "${to}"`);
  }

  // Write to a file for easy reference
  fs.writeFileSync(
    path.join(__dirname, '_renamed_keys.json'),
    JSON.stringify(allRenamedKeys, null, 2) + '\n',
    'utf8',
  );
  console.log(`\nRenamed keys written to _renamed_keys.json`);
}
