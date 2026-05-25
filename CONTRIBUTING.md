# Contributing to Letter Vault

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Follow the [Local Development](README.md#local-development) setup instructions
4. Create a feature branch from `main`

## Development Workflow

```bash
# Create a branch
git checkout -b feature/your-feature-name

# Make your changes, then run the build to check for errors
npm run build

# Test locally against MySQL
npm run dev
```

## Submitting Changes

1. Commit your changes with a clear, descriptive message
2. Push to your fork
3. Open a pull request against `main`
4. Fill out the PR template

## What We Look For

- Code follows the existing style (no linter configured yet — match what you see)
- No secrets, credentials, or `.env` values committed
- Database migrations are additive and backward-compatible
- New features are tested locally against MySQL
- README or docs updated if behavior changed

## Reporting Bugs

Use the [Bug Report](https://github.com/SaiHtetWaiYan/letter-vault/issues/new?template=bug_report.md) issue template.

## Suggesting Features

Use the [Feature Request](https://github.com/SaiHtetWaiYan/letter-vault/issues/new?template=feature_request.md) issue template.

## Security Issues

Do **not** open a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.

## Questions?

Open a thread in [Discussions](https://github.com/SaiHtetWaiYan/letter-vault/discussions).
