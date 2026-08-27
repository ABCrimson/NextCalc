# Level icon SVGs — runtime DATA, do not delete

These SVGs are referenced by production `User.image` database rows as avatar URLs
(`/icons/levels/level-NNN.svg`, plus the three level-101 admin variants) — they are runtime DATA,
not dead code, so a code-grep for consumers will always come up empty. Deleting them (this exact
mistake shipped in v1.5.0) breaks every avatar.

The art lives in `lib/level-icons/` (one source of truth shared with the live `LevelIcon` React
component, so nav/profile and these files are always identical). Regenerate with
`pnpm icons:levels` (= `tsx scripts/generate-level-icons.ts`) after changing the art.
