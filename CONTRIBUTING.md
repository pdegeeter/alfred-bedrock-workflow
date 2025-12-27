# Contributing

Contributions are welcome! Here's how you can help.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature
   ```

## Code Standards

- TypeScript with strict mode
- ESLint with `no-console` rule
- Prettier for formatting
- No runtime dependencies (uses native fetch)

## Before Submitting

Run all checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Keep commits focused and descriptive
4. Submit PR against `main` branch
