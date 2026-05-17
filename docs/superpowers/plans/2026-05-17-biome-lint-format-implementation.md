# Biome Lint And Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Biome as the repository-level formatter and linter without changing the existing test/typecheck workflow.

**Architecture:** Biome is configured once at the monorepo root. Root scripts expose formatting, linting, and combined quality checks while package-level `check` and `typecheck` scripts remain unchanged. The first rollout keeps rules close to Biome recommended defaults and ignores generated/local files.

**Tech Stack:** Bun workspaces, Turborepo, Biome, TypeScript, React, JSON, CSS.

---

## Files

- Modify: `package.json`
  - Add root scripts for format/lint/quality.
  - Add root `@biomejs/biome` dev dependency through `bun add -d`.
- Create: `biome.json`
  - Root Biome formatter/linter configuration.
- Modify: `README.md`
  - Document the new formatting and linting commands.
- Modify: formatted source/config files if `bun run format` changes them.
- Modify: `bun.lock`
  - Updated by `bun add -d @biomejs/biome`.

---

## Task 1: Add Biome Dependency, Config, And Scripts

**Files:**
- Modify: `package.json`
- Create: `biome.json`
- Modify: `bun.lock`

- [ ] **Step 1: Confirm the current baseline**

Run:

```bash
git status --short
bun run check
bun run typecheck
```

Expected:

```text
git status --short is empty before implementation starts
bun run check exits 0
bun run typecheck exits 0
```

- [ ] **Step 2: Install Biome at the root**

Run:

```bash
bun add -d @biomejs/biome
```

Expected:

```text
package.json devDependencies includes @biomejs/biome
bun.lock is updated
```

- [ ] **Step 3: Add root scripts**

Edit root `package.json` so the `scripts` object includes these entries while preserving the existing scripts:

```json
{
  "format": "biome format --write .",
  "format:check": "biome format .",
  "lint": "biome lint .",
  "lint:fix": "biome lint --write .",
  "quality": "bun run format:check && bun run lint && bun run check && bun run typecheck"
}
```

The resulting root `scripts` object should keep existing commands such as `dev`, `check`, `typecheck`, database scripts, and `render:project`.

- [ ] **Step 4: Create root Biome config**

Create `biome.json` with this content:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "root": true,
  "files": {
    "include": [
      "apps/**/*.ts",
      "apps/**/*.tsx",
      "apps/**/*.js",
      "apps/**/*.jsx",
      "apps/**/*.json",
      "apps/**/*.jsonc",
      "apps/**/*.css",
      "packages/**/*.ts",
      "packages/**/*.tsx",
      "packages/**/*.js",
      "packages/**/*.jsx",
      "packages/**/*.json",
      "packages/**/*.jsonc",
      "*.json",
      "*.jsonc",
      "*.ts",
      "*.js",
      "*.css",
      "README.md",
      "docs/**/*.md"
    ],
    "ignore": [
      "node_modules",
      ".turbo",
      ".worktrees",
      "dist",
      "build",
      ".vite",
      "short-workflow-data",
      ".env",
      ".env.*",
      "!.env.example",
      "bun.lock",
      "**/*.mp4",
      "**/*.mov",
      "**/*.mp3",
      "**/*.m4a",
      "**/*.wav",
      "**/*.aac",
      "**/*.png",
      "**/*.jpg",
      "**/*.jpeg",
      "**/*.webp"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  }
}
```

- [ ] **Step 5: Validate the config shape**

Run:

```bash
bun run lint
```

Expected if the config schema is accepted:

```text
Biome runs against the repository and reports either no diagnostics or source diagnostics.
It must not fail because biome.json has invalid schema keys.
```

If Biome rejects `files.include` or `files.ignore`, adjust only those keys to the current Biome schema shown in the CLI error, then rerun `bun run lint`.

- [ ] **Step 6: Commit config and scripts**

Run:

```bash
git add package.json bun.lock biome.json
git commit -m "chore: add biome tooling"
```

Expected:

```text
Commit succeeds with only package.json, bun.lock, and biome.json.
```

---

## Task 2: Format The Repository With Biome

**Files:**
- Modify: source/config/docs files changed by Biome formatting.

- [ ] **Step 1: Run the formatter**

Run:

```bash
bun run format
```

Expected:

```text
Biome formats files in-place.
Ignored files such as bun.lock, .env, node_modules, .turbo, media files, and short-workflow-data are not formatted.
```

- [ ] **Step 2: Review the formatting diff**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected:

```text
git diff --check exits 0
Diff contains formatting-only changes
No generated/local/media files are changed
```

- [ ] **Step 3: Verify format check**

Run:

```bash
bun run format:check
```

Expected:

```text
format:check exits 0
```

- [ ] **Step 4: Commit formatting changes if needed**

If `git status --short` shows formatting changes, run:

```bash
git add apps packages README.md docs package.json tsconfig.base.json turbo.json bunfig.toml
git commit -m "style: format repository with biome"
```

Expected:

```text
Commit contains formatting-only changes.
```

If `git status --short` is empty after `bun run format`, skip this commit and record that no formatting changes were needed.

---

## Task 3: Resolve Initial Biome Lint Findings

**Files:**
- Modify: source files reported by `bun run lint`, if any.
- Modify: `biome.json`, only if a recommended rule conflicts with intentional project behavior.

- [ ] **Step 1: Run lint**

Run:

```bash
bun run lint
```

Expected:

```text
Biome either exits 0 or reports concrete diagnostics.
```

- [ ] **Step 2: Apply safe lint fixes**

Run:

```bash
bun run lint:fix
```

Expected:

```text
Biome applies only safe fixes.
```

- [ ] **Step 3: Re-run lint**

Run:

```bash
bun run lint
```

Expected:

```text
lint exits 0, or remaining diagnostics are rule conflicts that need explicit config.
```

- [ ] **Step 4: Handle intentional rule conflicts**

If Biome reports `noConsole` in these files, keep console usage and disable only that rule:

- `apps/api/src/index.ts`
- `apps/render/src/render.ts`

Update `biome.json` with an override:

```json
{
  "overrides": [
    {
      "include": ["apps/api/src/index.ts", "apps/render/src/render.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    }
  ]
}
```

If Biome reports a different rule conflict, fix the source code when the fix is mechanical and low-risk. Only disable a rule when the current behavior is intentional and the override is scoped to the smallest file pattern.

- [ ] **Step 5: Verify lint is clean**

Run:

```bash
bun run lint
git diff --check
```

Expected:

```text
lint exits 0
git diff --check exits 0
```

- [ ] **Step 6: Commit lint fixes**

If Task 3 changed files, run:

```bash
git add .
git commit -m "fix: resolve biome lint findings"
```

Expected:

```text
Commit contains only lint-driven source fixes or scoped biome.json rule overrides.
```

If Task 3 changed no files, skip this commit.

---

## Task 4: Document The New Quality Commands

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add quality command documentation**

In `README.md`, replace the current `Verification` section with:

````md
## Verification

```bash
bun run format:check
bun run lint
bun run check
bun run typecheck
```

Run all quality gates together:

```bash
bun run quality
```

Apply formatting before committing:

```bash
bun run format
```
````

- [ ] **Step 2: Format README**

Run:

```bash
bun run format
```

Expected:

```text
README.md remains valid Markdown and is formatted consistently.
```

- [ ] **Step 3: Commit README update**

Run:

```bash
git add README.md
git commit -m "docs: document biome quality commands"
```

Expected:

```text
Commit succeeds with README.md only, unless Biome formatting updated another documentation file.
```

---

## Task 5: Final Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run format check**

Run:

```bash
bun run format:check
```

Expected:

```text
format:check exits 0
```

- [ ] **Step 2: Run lint**

Run:

```bash
bun run lint
```

Expected:

```text
lint exits 0
```

- [ ] **Step 3: Run package checks**

Run:

```bash
bun run check
```

Expected:

```text
All 8 package checks exit 0.
```

- [ ] **Step 4: Run type checks**

Run:

```bash
bun run typecheck
```

Expected:

```text
All 8 package typechecks exit 0.
```

- [ ] **Step 5: Run combined quality command**

Run:

```bash
bun run quality
```

Expected:

```text
format:check, lint, check, and typecheck all exit 0 through the combined command.
```

- [ ] **Step 6: Check git state**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
git diff --check exits 0
git status --short is empty
```

If `git status --short` is not empty, inspect the changes and either commit the intended remaining changes or revert only changes created by this Biome implementation.
