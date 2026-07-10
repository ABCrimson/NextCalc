# docs/wiki -- Source for the GitHub Wiki

This directory is the **source of truth** for the [NextCalc GitHub Wiki](https://github.com/ABCrimson/NextCalc/wiki). It is *not* automatically synced -- the wiki lives in a separate git repository (`NextCalc.wiki.git`, `master` branch, the standard GitHub-wiki-as-a-repo convention) and this folder is pushed to it manually.

This file itself (`docs/wiki/README.md`) is **not synced** to the wiki -- it exists only to document the sync process for contributors working in the main repo. The wiki's own landing page is [`Home.md`](Home.md).

## Why a separate repo

GitHub wikis are backed by their own git repository (`<repo>.wiki.git`), independent of the main repository's history, branches, and PR review. Keeping the authored content in `docs/wiki/` inside the main repo means:

- Wiki edits go through the same PR review as code changes
- Wiki content can reference (and be checked against) the actual codebase in the same commit
- The wiki repo itself stays a simple mirror -- no independent editing happens there

## Sync process

1. Edit the relevant `.md` file(s) in `docs/wiki/` as part of a normal PR to the main repo.
2. Once merged, clone or `cd` into a local checkout of the wiki repo:
   ```bash
   git clone https://github.com/ABCrimson/NextCalc.wiki.git
   ```
3. Copy the updated files from `docs/wiki/` into the wiki repo checkout (all files except this `README.md`, which is main-repo-only).
4. Commit and push to `master` using the project's `noreply` GitHub email (the primary account email is push-blocked on the wiki remote for this repo):
   ```bash
   git -c user.email="<noreply-email>" commit -m "sync: docs/wiki as of <main-repo-commit-sha>"
   git push origin master
   ```
5. The wiki repo has no CI of its own -- verify manually that internal `[[Page Name]]` links still resolve (GitHub wiki link syntax resolves by page title, not filename, so renames need care).

## Page inventory

| File | Wiki Page |
|:-----|:----------|
| `Home.md` | Home (landing page) |
| `Getting-Started.md` | Getting Started |
| `Architecture.md` | Architecture |
| `Math-Engine.md` | Math Engine |
| `Plot-Engine.md` | Plot Engine |
| `GraphQL-API.md` | GraphQL API |
| `Cloudflare-Workers.md` | Cloudflare Workers |
| `Database-Schema.md` | Database Schema |
| `Internationalization.md` | Internationalization |
| `Deployment.md` | Deployment |
| `FAQ.md` | FAQ |
| `_Sidebar.md` | Wiki sidebar (rendered on every page) |
| `_Footer.md` | Wiki footer (rendered on every page) |

## Last-synced state

As of 2026-07-10, the live wiki reflects **v1.5.0** — synced immediately after the v1.5.0 release (evergreen sweep, PR #74) from this directory at the release commit. `Home.md`, `_Footer.md`, and `_Sidebar.md` all display "v1.5.0".
