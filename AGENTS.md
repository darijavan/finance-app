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

Before committing, inspect the diff and run the relevant checks. Keep commits focused and independently buildable. After a successful commit, push it to `origin main` unless the task explicitly uses a feature branch.

A repository commit-msg hook enforces the title format. If it rejects a message, rewrite the title; do not bypass the hook.
