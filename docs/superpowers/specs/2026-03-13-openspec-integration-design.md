# OpenSpec Integration Design

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Repository-wide tooling setup

---

## Overview

Integrate [OpenSpec](https://github.com/Fission-AI/OpenSpec) into the Galaxy Shooter monorepo to establish a spec-driven development workflow. All non-trivial features will be proposed, designed, and tasked out before any code is written, using OpenSpec's artifact-guided workflow.

---

## Goals

- Pin OpenSpec as a versioned devDependency so all contributors get it via `npm install`
- Initialize the expanded workflow profile (full command set)
- Document the workflow in `CLAUDE.md` so Claude Code follows it automatically in every session

---

## Out of Scope

- No npm script wrappers for OpenSpec commands (slash commands are the interface)
- No changes to app source code, tests, or existing configs
- No `.gitignore` changes — `openspec/` is committed to the repo

---

## Dependency

Add to root `package.json` devDependencies:

```json
"@fission-ai/openspec": "latest"
```

Installed at the monorepo root (not inside any workspace). OpenSpec operates on the whole project.

---

## Initialization

After installing:

```bash
openspec init
openspec config profile   # select: expanded
```

This generates the `openspec/` directory containing agent instructions and slash command definitions. The entire `openspec/` directory is committed to git.

---

## CLAUDE.md Addition

A new `## Spec-Driven Development` section is added to `CLAUDE.md` covering:

- **Mandate:** All non-trivial features start with `/opsx:propose` — no code before a spec
- **Core flow:** `/opsx:propose` → `/opsx:apply` → `/opsx:archive`
- **Expanded commands:** `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:sync`, `/opsx:bulk-archive`, `/opsx:onboard`
- **Spec location:** `openspec/changes/<feature-name>/` (proposal.md, specs/, design.md, tasks.md)
- **Maintenance:** Run `openspec update` after upgrading OpenSpec to refresh agent instructions

---

## File Structure After Setup

```
openspec/
  changes/          # active feature specs
  # (archive/ created by /opsx:archive)
docs/
  superpowers/
    specs/
      2026-03-13-openspec-integration-design.md
```

---

## Implementation Steps

1. Add `@fission-ai/openspec` to root `package.json` devDependencies
2. Run `npm install` from repo root
3. Run `openspec init` from repo root
4. Run `openspec config profile` and select expanded
5. Commit `openspec/` directory to git
6. Add `## Spec-Driven Development` section to `CLAUDE.md`
7. Commit `CLAUDE.md` update
