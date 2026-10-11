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
├── Client/   # Bedrock Runtime, IAM Identity Center OIDC and portal APIs, AWS CLI
├── Command/  # Alfred entry points
├── Error/
├── Helper/   # Alfred output, region detection, short-term key signing, file cache
├── Service/  # Chat, credentials sources, SSO login and Bedrock token resolution
└── Type/     # Shared interfaces (one per file)

test/
├── Client/
├── Command/
├── Fixture/  # Test doubles such as the fake `aws` executable
├── Helper/
└── Service/
```

## Key Dependencies

- No runtime dependencies (uses native fetch for Bedrock API)
- `@tsconfig/node24` - Base TypeScript configuration
- `tsx` - TypeScript execution for tests
- `eslint-plugin-import-x` - Import linting with TypeScript support

## Alfred Configuration Variables

- `token` (optional) - Static Bedrock API bearer token
- `aws_profile` (optional) - AWS CLI profile whose credentials sign short-term keys (`aws configure export-credentials`)
- `sso_start_url`, `sso_role_name` (optional) - IAM Identity Center portal URL and role used to generate short-term keys when no static token is set
- `sso_region` (optional) - IAM Identity Center region, default: `eu-west-1`
- `sso_account_id` (optional) - AWS account of the role, auto-discovered when the role exists in a single account
- `browser` (optional) - Application opening the SSO login page (`open -a`), default browser when empty

All authentication variables are listed in `variablesdontexport`. Never commit real SSO URLs, role names or account IDs: their values live in Alfred's `prefs.plist` (git-ignored).
- `model` (optional) - Dropdown selection of available models, default: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`
- `default_lang` (optional) - Default target language for translations

Region is auto-detected from model prefix (`eu.` → `eu-west-1`, `us.`/`global.` → `us-east-1`).

## Bedrock Token Resolution

`BedrockTokenProvider` resolves the bearer token in this order:

1. `token` variable
2. A `CredentialsSource`, when configured:
   - `AwsProfileCredentialsSource` (`aws_profile`): `aws configure export-credentials`, with one `aws sso login` retry on an expired SSO session
   - `SsoCredentialsSource` (`sso_*`): IAM Identity Center access token (cache → refresh token → browser device login) → `GetRoleCredentials`

   A cached short-term key for `<source key prefix>:<region>` is reused (keys are region-bound); otherwise the credentials sign a new one as a SigV4-presigned `CallWithBearerToken` URL (`BedrockTokenGenerator`, byte-identical to `@aws/bedrock-token-generator`)
3. `AWS_BEARER_TOKEN_BEDROCK`, last so an ambient variable never hides an explicit configuration

A key is cached until `min(generation + 12h, credentials expiration)`, minus a 5-minute margin. State is stored in `$alfred_workflow_cache/auth.json` (mode 0600). A pending device authorization is persisted so a script killed by Alfred resumes polling instead of opening a new browser tab.

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
