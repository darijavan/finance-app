# Agent Working Agreement

## Commits are mandatory quality gates

Every agent working in this repository **must** use Conventional Commits and must never use `git commit --no-verify`.

Use this exact first-line format:

```text
<type>(<optional-scope>): <short imperative summary>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.

Examples:

```text
feat(activity): add persistent undo history
fix(fx): preserve historical quote date
refactor(validation): share transaction input sanitization
test(subscriptions): cover yearly due-date rules
chore(deps): update Next.js patch release
```

Before committing, inspect the diff and run the relevant checks. Keep commits focused and independently buildable. Changes reach `main` only through a pull request; see the workflow below.

A repository commit-msg hook enforces the title format. If it rejects a message, rewrite the title; do not bypass the hook.

## Feature and fix workflow

Unless the user says otherwise for that task, every change that touches files follows these steps:

1. **Work in a worktree.** Create one per task, on its own branch named with a Conventional Commit type prefix: `git worktree add ../finance-app-<slug> -b <type>/<slug>`, then `pnpm install --frozen-lockfile --offline` inside it. Never work on the main checkout or on `main`.
2. **Implement and verify.** Commit, then run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build`.
3. **Get an independent review.** Run `/review-branch <worktree-path> <base> -- <original request>`. It reviews in a fresh subagent that sees only the diff and the request. Quote the request as the user stated it, and never add your own explanations or justifications.
4. **Fix and land.**
   - Fix every **critical** finding, rerun the checks and commit. If the fixes are substantial, run `/review-branch` again.
   - Fix the **minor** findings that are cheap and clearly correct.
   - Push the branch and open a pull request with `gh pr create`. The description summarises the change and lists the minor findings left open.
   - If a critical finding can't be fixed, or fixing it needs a decision from the user, stop before pushing and ask.
5. **Remove the worktree.** Once the pull request is open and ready for review, run `git worktree remove ../finance-app-<slug>` from the main checkout. The branch stays on the remote and locally. If the pull request needs more changes later, run `git worktree add ../finance-app-<slug> <type>/<slug>` and start again from step 2.

## Spacing

Keep at most one successive empty line in TypeScript and JavaScript source. Leave a blank line before `return` when it follows another statement in the same block; no padding is required when `return` is the first statement. Both rules use `@stylistic/eslint-plugin` through Oxlint. Run `pnpm lint:fix` to fix spacing automatically.
