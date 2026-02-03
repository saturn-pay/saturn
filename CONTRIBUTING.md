# Contributing to Saturn

Saturn is a Lightning-powered API proxy for AI agents, built with TypeScript and Express.

## Development Setup

```bash
git clone https://github.com/<your-fork>/saturn.git
cd saturn
npm install
cp .env.example .env   # then fill in your local config
npm run dev             # starts the dev server with tsx
```

## Testing

Saturn uses [Vitest](https://vitest.dev/) for testing. The suite currently has 52 tests.

```bash
npm test            # run all tests once (vitest run)
npm run test:watch  # re-run tests on file changes (vitest)
```

All tests must pass before submitting a pull request.

## Type Checking

The project uses TypeScript in strict mode. Verify your changes compile cleanly:

```bash
npx tsc --noEmit
```

## Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Make your changes.
3. Ensure all tests pass (`npm test`) and types check (`npx tsc --noEmit`).
4. Open a pull request against `main` with a clear description of what you changed and why.

Keep pull requests focused on a single concern. If you are fixing a bug and refactoring nearby code, prefer separate PRs.

## Code Style

- TypeScript strict mode is enabled. Do not use `any` unless absolutely necessary.
- Follow the patterns already established in the codebase.
- Database access goes through [Drizzle ORM](https://orm.drizzle.team/). Use the existing schema definitions and query patterns rather than raw SQL.
- Prefer explicit types over inference for function signatures and public interfaces.

## Security

- Never commit secrets, API keys, or credentials. Use environment variables via `.env` (which is gitignored).
- Be especially careful with financial logic. Saturn deals in sats accounting -- off-by-one errors or rounding mistakes can cause real monetary loss. Add tests for edge cases around balances, payments, and fee calculations.
- To report a security vulnerability, see `SECURITY.md`.

## License

By contributing to Saturn, you agree that your contributions will be licensed under the Business Source License 1.1 (BUSL-1.1). See `LICENSE` for details.
