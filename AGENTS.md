# AGENTS.md – Rules for Codex Agent

## Project Type
- This is a simple JavaScript/Canvas game.
- No framework or development server is required.
- No automatic dependency installation is needed.
- Do NOT run `npm install`, `npm ci`, or try detecting Node projects.

## File Management Rules
- Only modify files in the project root directory (`/workspace/special-pancake`).
- Do not create or modify files outside this directory.
- Ignore the `node_modules/` folder completely.

## Git Rules
- Always push changes to the **main** branch unless the user explicitly requests another.
- Do NOT create temporary branches such as `work`.
- Do NOT remove or modify the `origin` remote unless instructed.
- Always include all modified files in commits except ignored items.
- Do not generate merge commits unless explicitly asked.

## Behavior Rules
- Do NOT search for dependency files or run auto-setup routines.
- Do NOT attempt to detect tooling like webpack, vite, parcel, or react-scripts.
- Do NOT run tests automatically.
- Only run commands the user explicitly asks for.
- Always ask the user before installing packages or modifying project structure.

## Ignore These Files
- node_modules/
- npm-debug.log*
- yarn-error.log*
- .DS_Store

## Domain Notes
- This project is intentionally lightweight.
- Rendering is handled directly via HTML Canvas API.
- No bundler or compilation step should be introduced.

