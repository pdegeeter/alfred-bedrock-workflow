# CLAUDE.md

This file provides guidance to Claude Code when working on this project.

## Project Overview

Alfred Bedrock Workflow is a TypeScript-based Alfred workflow that integrates with Amazon Bedrock to provide AI responses directly from Alfred.

## Build & Test Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm test` - Run unit tests with node:test
- `pnpm lint` - Check for linting errors
- `pnpm lint:fix` - Fix auto-fixable linting errors
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Run TypeScript type checking

## Architecture

```
src/
├── Client/
├── Command/
├── Helper/
└── Service/

test/
├── Client/
├── Command/
├── Helper/
└── Service/
```

## Key Dependencies

- No runtime dependencies (uses native fetch for Bedrock API)
- `@tsconfig/node24` - Base TypeScript configuration
- `tsx` - TypeScript execution for tests
- `eslint-plugin-import-x` - Import linting with TypeScript support

## Alfred Configuration Variables

- `token` (required) - Bedrock API bearer token
- `model` (optional) - Dropdown selection of available models, default: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`
- `default_lang` (optional) - Default target language for translations

Region is auto-detected from model prefix (`eu.` → `eu-west-1`, `us.`/`global.` → `us-east-1`).

## Alfred Workflow Triggers

Each command has three entry points:

1. **Script Filter** - Keyword-triggered (e.g., `bedrock`, `aspell`, `translate`)
2. **Universal Action** - Text selection via Alfred Universal Actions
3. **Hotkey** - Configurable keyboard shortcut with "Selection in macOS"

All triggers connect to the same Script Filter, then to outputs (Text View, Copy, Paste).

## Code Style

- ESLint with `strictTypeChecked` rules
- `eslint-plugin-import-x` for import validation
- `sort-keys` rule enforces alphabetical key ordering
- `no-console` rule prevents console usage
- Prettier handles formatting

## Documentation

Update `CLAUDE.md`, `CONTRIBUTING.md` and `README.md` when:

- Adding new source files or directories
- Adding new commands or scripts
- Changing the project architecture
- Adding new dependencies

## Running the Workflow
