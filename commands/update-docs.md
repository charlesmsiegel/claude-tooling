<!--
Update Docs Command - Rebuild the project documentation skill from scratch.

Installation: Copy to .claude/commands/update-docs.md
Usage: /update-docs
Settings: {
  "permissions": {
    "allow": ["Skill(update-docs)"]
  }
}
-->
Perform a full refresh of the project documentation skill at `.claude/skills/documentation/`.

## Step 1: Parallel exploration with haiku subagents

Dispatch these Agent calls **in parallel**, each using `model: haiku` and `subagent_type: Explore`:

1. **Structure agent** — "Map out the top-level directory structure (3 levels deep). List every directory and what it contains. Identify entry points, build files, and config files."
2. **Code patterns agent** — "Identify the languages, frameworks, and libraries used. Look at imports, package manifests (package.json, requirements.txt, Cargo.toml, go.mod, etc.), and build configs. Note architectural patterns (MVC, event-driven, microservices, monorepo, etc.)."
3. **Data flow agent** — "Trace how data moves through the system. Find API endpoints, database models/schemas, message queues, event handlers, and external service calls. Map the main request/response paths."
4. **Conventions agent** — "Identify project-specific conventions: naming patterns, file organization rules, error handling patterns, logging approach, test structure, and any CLAUDE.md or CONTRIBUTING.md guidance."

## Step 2: Read relevant files

Based on what the explore agents found, read the specific files they flagged as most important — entry points, core modules, config files, schemas. Don't read everything; read what's needed to write accurate documentation.

## Step 3: Write the documentation skill

Create or overwrite `.claude/skills/documentation/SKILL.md` and the appropriate `references/*.md` files. Follow the structure described in the project's CLAUDE.md documentation skill section.

**SKILL.md** should contain:
- Frontmatter with `name: documentation` and a description starting with "Use when..."
- Project overview (what it does, who it's for, key concepts)
- Architecture summary (how components fit together)
- Quick-start for a new developer (build, run, test)
- Index of reference files with one-line descriptions

**Reference files** — create only what the project needs. Common ones:
- `components.md` — module/component deep dives
- `data-flow.md` — how data moves through the system
- `conventions.md` — project-specific patterns and idioms
- `api.md` — endpoints, schemas, contracts
- `infrastructure.md` — deployment, CI/CD, environments

Remove reference files that no longer match the project's shape. Add new ones if the project has grown into areas not yet covered.

## Step 4: Commit

Stage and commit the documentation changes with message: `docs: update project documentation skill`
