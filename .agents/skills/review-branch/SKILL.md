---
name: review-branch
description: Independent review of a feature or fix branch, run in a fresh context that sees only the diff and the original request. Use after implementing and committing in a worktree, before marking the branch's draft pull request ready for review.
argument-hint: <worktree-path> <base-branch> -- <original request, quoted as the user stated it>
context: fork
agent: general-purpose
background: false
disallowed-tools: Edit Write NotebookEdit
---

# Review a branch

## First: make sure the review runs in a fresh context

This review only counts if the reviewer has never seen the implementation. Claude Code runs this skill in a fresh subagent on its own (the `context: fork` setting above). Other agents ignore that setting, so check yourself first.

**If this conversation contains you writing or discussing this change, you are the implementer. Do not review it yourself.** Start a fresh reviewer instead. Every option below gives it the same prompt:

> Read `.agents/skills/review-branch/SKILL.md` and follow it as the reviewer. Arguments: `<worktree-path> <base-branch> -- <original request>`

1. **`$REVIEW_AGENT` is set** (`claude`, `codex` or `gemini`): run that CLI's command from the list below, even if your agent has subagents. This is how you ask a different agent for a second opinion.
2. **Otherwise, if your agent has subagents with no conversation history:** give the prompt to one of them.
3. **Otherwise:** run the first of these CLIs that is installed, as a separate process started inside the worktree.

The reviewer has to run the project's checks, and they write gitignored caches such as `tsconfig.tsbuildinfo` and `node_modules/.vite`. So each command lets the reviewer run shell commands and write inside the worktree. What keeps the code untouched is this skill's rule against editing files.

- `cd <worktree> && claude -p "<prompt>" --disallowedTools "Edit Write NotebookEdit" --allowedTools "Bash(pnpm *)" "Bash(git *)"`
- `codex exec -C <worktree> --sandbox workspace-write "<prompt>"`
- `cd <worktree> && gemini -p "<prompt>" --approval-mode yolo`

If none of these options is available, stop. Tell the user that no fresh-context reviewer is available, and don't review the change yourself.

Then relay the reviewer's report and verdict word for word.

**If you have no memory of the change**, you are the reviewer: carry on below. If `$ARGUMENTS` below appears literally, your agent didn't fill it in, so take the arguments from the message that invoked you.

## Review

You are an outside reviewer. You did not write this change and you have none of the implementer's reasoning. Judge it only from the code and the request.

**Never edit, create, stage or commit files.** Read files, run read-only git commands and run the checks below. Nothing else.

### Input

`$ARGUMENTS`

In order: the worktree path, the base branch, `--`, then the original request or plan as the user stated it. If the worktree path or base branch is missing, stop and say so. If the request is missing, review for correctness only and say that you could not check the change against the request.

### Steps

1. The shell's working directory does not carry over between commands, so start every command with `cd <worktree> &&` and use absolute paths. Otherwise the checks run against the main checkout. Read the change: `git log --oneline <base>..HEAD` and `git diff <base>...HEAD`. Read the surrounding code of every touched function, and grep the callers of anything whose behaviour changed.
2. Read `AGENTS.md`, `GLOSSARY.md` and the ADRs in `docs/adr/` that touch the changed area. Skip any that don't exist, without comment.
3. Run the checks yourself rather than trusting the implementer: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`. A failing check is a finding.
4. Look for:
   - **Correctness**: bugs and broken edge cases. In this app, pay most attention to money, FX conversions, dates and time zones, months and rollovers, and data that is null or missing.
   - **Security**: unvalidated input at API routes, injection, unsafe file handling, secrets.
   - **The request**: behaviour that differs from what was asked, requirements that were missed, and changes nobody asked for.
   - **Domain language**: names or behaviour that drift from `GLOSSARY.md` terms (including words it lists under _Avoid_), and changes that contradict an ADR.
   - **Conventions**: what `AGENTS.md` requires, including Conventional Commit titles, focused commits and the spacing rules.
   - **Tests**: non-trivial logic (money, FX, dates, parsing, branching) with no test that would fail if the logic broke, and tests that leak state such as timers, stubbed globals or mocks.
   - **Over-engineering**: speculative abstractions, reimplemented standard library or platform features, unneeded dependencies, and code that could simply be deleted.

### Report

List the findings, most severe first. For each one, give:

- **critical** or **minor**
  - **Critical**: a security issue, or behaviour that contradicts the request, the plan or an ADR.
  - **Minor**: everything else.
- `file:line`
- What is wrong, and a concrete failure scenario: which inputs or state produce which wrong result.
- The fix, in one line, if it is obvious.

Then give one line with the check results.

End with the verdict, on its own line, for the commit you reviewed (`git rev-parse --short HEAD`):

- `Verdict: ready to merge (<sha>)`: no critical findings and every check passes. Minor findings don't block it.
- `Verdict: not ready (<sha>)`: anything else.

Don't pad: leave out any category with no findings, and don't praise the change.
