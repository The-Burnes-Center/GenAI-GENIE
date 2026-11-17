# Contributing

Thanks for helping improve Genie.

## Before you start

- Read [ARCHITECTURE.md](ARCHITECTURE.md). It is the contract for the API, the chat stream, the data model, the limits that must not regress, and resource naming.
- UI work follows [design/DESIGN.md](design/DESIGN.md) and the prototype in `design/prototype/`.

## Working locally

```bash
npm run install:all
npm run dev:mock      # web app with a mock backend
npm run check         # typecheck, lint, tests, build
npm run synth         # CloudFormation template
```

## Standards

- **Tests:** add or update tests with every change. `npm run check` must pass.
- **Limits:** never add a cap, truncation or small default (reply length, history, retrieval, file size) without updating the limits section of ARCHITECTURE.md and telling the person in the UI when it applies.
- **Accessibility:** WCAG 2.2 AA. New screens need zero axe violations and a working keyboard path.
- **Naming:** AWS resources follow `genie-{env}-*` and carry the four standard tags. React components use PascalCase files; other files use kebab-case.
- **Code:** small files and functions, early returns, named constants, explicit error handling with a friendly message in the UI and detail in the server log.
- **Secrets:** never commit credentials, account ids or `infra/config.json`.
- **Commits:** conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `ci:`).

## Reporting security issues

Please report security issues privately to the maintainers rather than in a public issue.
