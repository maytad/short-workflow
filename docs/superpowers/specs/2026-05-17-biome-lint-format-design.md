# Biome Lint And Format Design

## Summary

Short Workflow currently has tests and TypeScript checks, but no repository-level lint or format tool. The MVP should add a low-friction quality layer without creating a large ESLint/Prettier configuration surface.

The selected approach is Biome as the root-level formatter and linter for the Bun/Turborepo monorepo.

## Goals

- Add one consistent formatting command for the entire repository.
- Add one consistent lint command for TypeScript, TSX, JavaScript, JSON, and CSS files.
- Keep setup simple for a single-user MVP.
- Preserve the existing `check` and `typecheck` workflow.
- Avoid formatting generated, local, dependency, binary, and asset-output files.
- Make the tool easy to add to CI later.

## Non-Goals

- Do not add ESLint in the first pass.
- Do not add Prettier in the first pass.
- Do not replace TypeScript typechecking with Biome linting.
- Do not make `bun run check` depend on linting immediately.
- Do not introduce pre-commit hooks in the first pass.
- Do not tune an extensive custom rule set before seeing real lint output.

## Decision

Use Biome first.

Biome is a better fit for this repository right now because it provides formatter and linter coverage with one dependency and one config file. This keeps operational overhead low while the project is still an MVP. TypeScript remains responsible for type-level correctness through the existing `typecheck` scripts.

ESLint can be added later if the project needs type-aware linting, React accessibility rules, import-boundary rules, or ecosystem plugins that Biome does not cover.

## Tooling Layout

Add Biome at the repository root only:

```text
short-workflow/
  biome.json
  package.json
```

`@biomejs/biome` should be a root `devDependency`. Individual apps and packages should not get their own Biome dependency or config in the MVP.

## Root Scripts

Add root scripts:

```json
{
  "format": "biome format --write .",
  "format:check": "biome format .",
  "lint": "biome lint .",
  "lint:fix": "biome lint --write .",
  "quality": "bun run format:check && bun run lint && bun run check && bun run typecheck"
}
```

`quality` is a convenience command. It should not replace `check` yet, because `check` currently means package tests and migration checks. Keeping these concerns separate lowers rollout risk.

## Biome Configuration

The root `biome.json` should:

- Set `root: true`.
- Enable the formatter.
- Enable the linter.
- Enable recommended lint rules.
- Use LF line endings.
- Use two-space indentation.
- Use a line width that matches the existing codebase without excessive churn. A 100-character line width is the preferred starting point.
- Use JavaScript/TypeScript formatting settings close to the current code style: semicolons enabled, double quotes, trailing commas where Biome considers them appropriate.

The config should avoid aggressive custom rules in the first pass. The first implementation should focus on establishing the tool and making the repository pass.

## File Scope

Biome should cover source and configuration files that it understands:

- `apps/**/*.ts`
- `apps/**/*.tsx`
- `apps/**/*.js`
- `apps/**/*.jsx`
- `apps/**/*.json`
- `apps/**/*.jsonc`
- `apps/**/*.css`
- `packages/**/*.ts`
- `packages/**/*.tsx`
- `packages/**/*.js`
- `packages/**/*.jsx`
- `packages/**/*.json`
- `packages/**/*.jsonc`
- Root JSON/config files Biome supports.

Biome should ignore:

- `node_modules`
- `.turbo`
- `.worktrees`
- `dist`
- `build`
- `.vite`
- `short-workflow-data`
- local environment files
- generated media files
- local render output files

`bun.lock` should stay out of the initial formatting pass to avoid noisy lockfile churn.

## Existing Commands

Keep current commands:

- `bun run check`
- `bun run typecheck`
- package-level `check` scripts
- package-level `typecheck` scripts

The implementation may update docs to mention the new commands, but it should not redefine the meaning of `check` in the same change.

## Expected Developer Flow

Before committing code:

```bash
bun run format
bun run lint
bun run check
bun run typecheck
```

For CI-style verification:

```bash
bun run quality
```

If formatting creates a large diff, the implementation should keep the config/tooling commit separate from any mass-format commit.

## Error Handling

If Biome reports many existing lint findings, prefer one of these approaches:

1. Fix safe issues that are mechanical and low-risk.
2. Narrow initial lint scope only if findings come from generated or unsuitable files.
3. Disable a specific recommended rule only if it conflicts with established project behavior and the reason is documented in `biome.json`.

Do not hide broad classes of source files just to make lint pass.

## Testing And Verification

Implementation must run:

```bash
bun run format:check
bun run lint
bun run check
bun run typecheck
git diff --check
```

If the implementation applies formatting, rerun all commands after formatting.

## Future Extensions

Later additions can include:

- CI job for `bun run quality`.
- Editor setup notes for Biome.
- Pre-commit formatting once the workflow stabilizes.
- ESLint as a second-stage lint tool if Biome cannot cover React accessibility, typed linting, or import boundary needs.
