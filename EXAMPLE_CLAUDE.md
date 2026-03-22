# EXAMPLE_CLAUDE.md

> **This is a template.** Copy the sections below into your project's `CLAUDE.md`, then run `/update-docs` to generate the initial documentation skill. After that, Claude maintains it automatically.

---

## Documentation Skill

This project maintains a self-updating documentation skill at `.claude/skills/documentation/`. It serves as the primary way for Claude to orient in the codebase — and as a reference for human contributors.

### How it works

The documentation lives as a Claude skill: a `SKILL.md` entry point with `references/` files for deeper detail. When Claude loads the skill, it gets a high-level understanding of the project. When it needs more depth on a specific area, it reads the relevant reference file. This progressive disclosure keeps token usage low while making the full picture available.

```
.claude/skills/documentation/
├── SKILL.md              # Project overview, architecture, quick-start, reference index
└── references/
    ├── components.md     # Module and component deep dives
    ├── data-flow.md      # How data moves through the system
    ├── conventions.md    # Naming, patterns, project-specific idioms
    └── ...               # Others as the project requires
```

The reference files are not fixed. A small CLI tool might only need `SKILL.md` and `conventions.md`. A large platform might have `api.md`, `infrastructure.md`, `data-flow.md`, and per-subsystem files. Claude adds and removes reference files as the project evolves.

### Keeping it current

**Automatic updates:** After making significant changes — adding a new module, changing the architecture, introducing a new pattern, modifying API contracts, or restructuring directories — update the documentation skill to reflect what changed. This means:

- If you added or removed a component, update `SKILL.md` and the relevant reference file
- If you changed how data flows, update `data-flow.md`
- If you established a new convention, update `conventions.md`
- If a reference file no longer describes anything real, delete it
- If the project has grown a new area not covered by any reference file, create one

Do not rewrite the entire skill for small changes. Update the specific sections affected. The goal is accuracy, not freshness theater.

**On-demand full refresh:** Run `/update-docs` to regenerate the documentation skill from scratch. Use this for:

- Initial setup on a new project
- Onboarding the skill to an existing codebase
- After a large refactor where incremental updates would be error-prone
- Periodic audit (quarterly or when things feel stale)

### How `/update-docs` works

The command dispatches parallel haiku subagents to cheaply explore the codebase:

1. **Structure agent** — maps directories, entry points, build files
2. **Code patterns agent** — identifies languages, frameworks, architecture
3. **Data flow agent** — traces APIs, schemas, data paths
4. **Conventions agent** — finds naming patterns, error handling, test structure

The main agent then reads the specific files these explorers flag as important and writes the skill. This avoids expensive full-codebase reads while producing accurate documentation.

### SKILL.md structure

The entry point should follow this format:

```markdown
---
name: documentation
description: Use when onboarding to this project, needing to understand architecture,
  finding where code lives, or learning project conventions. Read this before exploring
  the codebase.
---

# [Project Name]

[One paragraph: what this project does, who uses it, why it exists.]

## Architecture

[How the major pieces fit together. Keep it to the level where someone can form a
mental model — not so detailed that it duplicates the code.]

## Quick Start

[Build, run, test — the three commands a new developer needs on day one.]

## Key Concepts

[Domain terms, abstractions, or patterns that aren't obvious from the code alone.]

## Reference Index

| File | Covers |
|------|--------|
| `references/components.md` | Module responsibilities and boundaries |
| `references/data-flow.md` | Request lifecycle, data transformations |
| `references/conventions.md` | Naming, error handling, test patterns |
| ... | ... |
```

### Reference file structure

Each reference file covers one area in enough detail that Claude (or a human) can work in that area without reading the source first:

```markdown
# [Area Name]

[What this area is responsible for. 2-3 sentences.]

## [Subsection per component/concept]

[What it does, how it's used, what it depends on, any gotchas.]
```

**Guidelines for reference files:**
- Write for someone who has read `SKILL.md` but hasn't seen the code yet
- Include file paths so the reader can jump to source when they need more
- Describe *what* and *why*, not *how* — the code shows how
- Keep each reference file under 300 lines; split if it grows larger
- Use the project's own terminology, not generic descriptions

### What NOT to document

- Things derivable from reading the code (function signatures, type definitions)
- Git history (use `git log`)
- Transient state (current sprint goals, in-progress work)
- Exhaustive API references (link to generated docs if they exist)

The documentation skill captures the knowledge that's hard to extract from the code alone: *why* things are the way they are, how the pieces connect, and what conventions to follow.

### Installation

1. Copy the relevant sections above into your project's `CLAUDE.md`
2. Copy `.claude/commands/update-docs.md` into your project's `.claude/commands/`
3. Run `/update-docs` to generate the initial documentation skill

Or use the installer from [claude-tooling](https://github.com/your-org/claude-tooling):

```bash
python install.py commands update-docs --target /path/to/your/project
```

Then add the CLAUDE.md sections manually (the installer handles the command, not the CLAUDE.md content — that's project-specific).
