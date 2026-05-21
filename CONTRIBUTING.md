# Contributing to Mosaic Manage

Thanks for your interest in contributing. Guidelines will be expanded as the project matures.

## General Rules

- Keep PRs small and focused on a single concern.
- Write clear commit messages — explain the *why*, not just the *what*.
- Open an issue before starting large changes so we can align on direction.

## Branching

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready |
| `dev` | Integration branch for active work |
| `feature/*` | Individual features or improvements |
| `fix/*` | Bug fixes |

## Commit Style

```
type(scope): short description

Examples:
feat(auth): add OAuth2 login flow
fix(api): handle null response from user endpoint
chore: update dependencies
```

## Code Style

- Consistent formatting enforced via project linter (config TBD).
- No commented-out code in PRs.
- Tests required for new features.

---

More detailed guidelines will be added as the stack is finalized.
