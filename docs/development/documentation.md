# Documentation

[Contributor guide](../../DEVELOPMENT.md) · [Development guides](README.md)

- Keep the root README concise: purpose, prerequisites, startup and essential commands.
- `AGENTS.md` and `DEVELOPMENT.md` own repository rules. `docs/development/`
  and the retained specialist topics own task-specific requirements.
- User-facing website guides live in `site/src/content/docs/` and remain part
  of the website build. Runtime Markdown and regression fixtures are source assets.
- Do not add plans, investigation reports, session logs, knowledge bases or
  feature documentation unless the user requests them. Record rationale and
  verification in the conversation or PR description.
- Correct existing usage instructions when a change makes them inaccurate.
  Preserve security requirements, compatibility gates and test obligations.
- Historical plans, research and defect notes remain available in Git history.
  Their removal is housekeeping, not evidence that outstanding work was fixed.
