# Finance App instructions for Claude Code

Read and follow [`AGENTS.md`](AGENTS.md) before making changes. In particular, Conventional Commit titles are mandatory, `--no-verify` is forbidden, commits must be focused, and completed main-branch work must be pushed to `origin main`.

For project architecture, schema migration, historical-FX, deployment, and verification conventions, follow the repository documentation and existing patterns.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `darijavan/finance-app` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
