/**
 * CSS Module Type Declarations
 *
 * TypeScript 6.0 with noUncheckedSideEffectImports requires
 * type declarations for side-effect imports like CSS files.
 *
 * This file declares module types for:
 * - Plain CSS files (.css)
 * - CSS Modules (.module.css)
 * - Sass files (.scss, .sass)
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
 */

// Plain CSS files (side-effect imports)
declare module '*.css' {
  const content: void;
  export default content;
}

// CSS Modules (with exported classNames)
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Sass/SCSS files
declare module '*.scss' {
  const content: void;
  export default content;
}

declare module '*.sass' {
  const content: void;
  export default content;
}

// Sass/SCSS modules
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
