# Contributing to @plasius/gpu-lighting

First off: thanks for taking the time to contribute.
This document explains how to work on the project, propose changes, and open pull requests.

> TL;DR
>
> - Be respectful and follow the Code of Conduct.
> - Open an issue before large changes; small fixes can go straight to a PR.
> - Write tests and keep coverage steady or improving.
> - Use Conventional Commits.
> - Do not include sensitive data in code, issues, tests, or logs.

---

## Code of Conduct

Participation in this project is governed by our **Code of Conduct** (see `CODE_OF_CONDUCT.md`). By participating, you agree to abide by it.

## Licensing & CLA

This project is open source (see `LICENSE`). Contributors must sign the CLA before their first PR is merged (see `legal/CLA.md`).

## Security

Never report security issues in public issues or PRs. Follow `SECURITY.md` for private disclosure.

---

## What this project does

`@plasius/gpu-lighting` provides advanced lighting technique modules and planning profiles for WebGPU workflows:

- Lumen-inspired hybrid realtime GI/reflections scaffolding.
- Path-traced reference technique modules for validation.
- Volumetric lighting and HDRI/IBL technique modules.
- Loader APIs designed to plug into `@plasius/gpu-worker` WGSL assembly.

---

## Getting started (local dev)

### Prerequisites

- Node.js 24 (see `.nvmrc`).
- A browser with WebGPU support for demo validation.

### Install

```sh
npm ci
```

### Build

```sh
npm run build
```

### Test

```sh
npm test
```

---

## How to propose a change

### 1) For bugs

- Search existing issues first.
- Open a new issue with repro steps, expected vs actual behavior, and environment details.

### 2) For features / refactors

- Open an issue first for non-trivial changes.
- If the change affects architecture or public APIs, add a new ADR in `docs/adrs/`.

### 3) Pull Requests

- Keep PRs focused.
- Add/update tests.
- Update docs (README, ADRs, CHANGELOG) when behavior changes.

---

## Branch, commit, PR

**Branching**

- Create a feature branch from `main`: `feat/xyz` or `fix/abc`.

**Commit messages**

Use Conventional Commits, e.g.:

- `feat: add pathtracer technique loader`
- `fix: validate unknown profile names`
- `docs: add ADR for volumetric lighting`
- `test: add technique manifest coverage`

---

## Coding standards

- Language: JavaScript + WGSL.
- Keep WGSL modules explicit and composable.
- Prefer API stability and SemVer-safe additions.
- Keep runtime dependencies minimal.

### WGSL specifics

- Keep data layouts explicit and documented.
- Keep each job focused and testable.
- Use clear labels and source names for worker integration.

---

## Documentation

- Update `README.md` for new APIs and workflows.
- Add a new ADR (do not rewrite accepted ADR history) for architectural changes.

Thanks for contributing.
