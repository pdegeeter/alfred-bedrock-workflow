# Contributing

Contributions are welcome! Here's how you can help.

## Development Setup

1. Fork and clone the repository
2. Install a stable [Rust toolchain](https://rustup.rs/) with `clippy` and `rustfmt`
3. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature
   ```
4. Build and install the workflow in Alfred:
   ```bash
   make install
   ```

`make help` lists the targets. How the workflow works is described in [`docs/`](docs/).

## Code Standards

- Rust 2024 edition, `unsafe_code` forbidden
- Clippy with the `pedantic` group (see `[lints]` in `Cargo.toml`); warnings fail the CI
- `rustfmt` for formatting (`rustfmt.toml`)
- One struct, enum or trait per file; traits shared across modules live in `src/types/`
- Constants and helpers are associated items (`const`, `fn`) of the type using them, not free items
- External systems are reached through ports injected from `main.rs`: `HttpClient` (HTTPS) and `UrlOpener` (browser)
- No runtime dependency on the user environment: the workflow must run with an empty `PATH`
- Never commit real SSO start URLs, role names, account IDs or tokens: use placeholders such as `https://my-org.awsapps.com/start` and `123456789012`

## Tests

- Unit tests of pure logic sit next to the code, in `#[cfg(test)]` modules
- `tests/` exercises the public API: HTTP clients against a stub transport, and services with a real cache file and a fake `aws` executable (`tests/fixture/`)
- Expiry is tested by editing `auth.json`, not by mocking the clock

## Before Submitting

Run all checks, as the CI does:

```bash
make check
```

## Commit Messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): they drive the version and the changelog.

| Prefix | Effect on the next release |
| --- | --- |
| `fix:` | patch version, listed under Bug Fixes |
| `feat:` | minor version, listed under Features |
| `feat!:` or a `BREAKING CHANGE:` footer | major version |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:` | no release on their own, not listed |

Dependabot (`.github/dependabot.yml`) opens weekly pull requests following this format: `ci:` for GitHub Actions, grouped, and `chore(deps):` for Cargo, minor and patch updates grouped, majors one by one.

When a pull request is squash-merged, its title becomes the commit message: it must follow the same format.

## Releasing

Versions are managed by [release-please](https://github.com/googleapis/release-please); never edit them by hand.

1. Every push to `main` updates a release pull request that bumps `version` in `Cargo.toml`, `Cargo.lock` and `info.plist`, and adds the new entries to `CHANGELOG.md`
2. Merging it tags `vX.Y.Z` and creates the GitHub release; the `upload` job then runs `make check`, builds the workflow and attaches `bedrock.alfredworkflow`

Configuration: `release-please-config.json` and `.release-please-manifest.json` (last released version). The repository setting "Allow GitHub Actions to create and approve pull requests" must be enabled. With only `GITHUB_TOKEN`, the release pull request does not trigger the CI; add a `RELEASE_PLEASE_TOKEN` secret (fine-grained token with contents and pull requests write access) to run it.

## Pull Request Process

1. Ensure all checks pass
2. Update documentation if needed
3. Keep commits focused and descriptive
4. Submit PR against `main` branch
