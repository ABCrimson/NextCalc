# Level icon SVGs — runtime DATA, do not delete

These SVGs are referenced by production `User.image` database rows as avatar URLs
(`/icons/levels/level-NNN.svg`, plus the three level-101 admin variants) — they are runtime DATA,
not dead code, so a code-grep for consumers will always come up empty. Deleting them (this exact
mistake shipped in v1.5.0) breaks every avatar. Regenerate via `npx tsx scripts/generate-level-icons.ts`.
