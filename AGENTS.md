# Repository Guidelines

## Project Structure & Module Organization

- `apps/backend` — NestJS REST API compiled with Rspack; primary entry is `src/main.ts`, with unit specs under `src/app/*.spec.ts` and assets in `src/assets`.
- `apps/frontend` — React SPA using Ant Design and Tailwind; component code lives in `src/app`, global styles in `src/styles.css`, and Jest specs alongside components.
- `deploy/` — Container deployment support (nginx config, compose files).
- Root configs (`nx.json`, `tsconfig.base.json`, `eslint.config.mjs`, `Dockerfile.*`) govern the entire workspace.

## Build, Test, and Development Commands

- `npx nx serve backend` — Rebuilds and runs the Nest server with live reload on port 3000.
- `npx nx serve frontend` — Starts the React dev server with Rspack HMR on port 4200.
- `npx nx build <project> --configuration=production` — Produces optimized bundles for `backend` or `frontend`.
- `docker-compose up --build` — Builds and launches both containers using the provided Dockerfiles.

## Coding Style & Naming Conventions

- Language: TypeScript (ES2022). Use descriptive camelCase for variables/functions and PascalCase for classes/components.
- Formatting: Prettier defaults via `.prettierrc`; rely on `npx nx format:write` before committing.
- Linting: ESLint rules from `eslint.config.mjs`; run `npx nx lint <project>` if new targets are added.
- CSS: Tailwind utility classes preferred; keep custom styles in `src/styles.css`.

## Testing Guidelines

- Framework: Jest (`@nx/jest`) for unit tests; Ant Design requires the `jest.setup.ts` polyfills already in place.
- Naming: Co-locate specs as `<name>.spec.ts(x)` next to the code under test.
- Expectations: Add tests for new logic paths and React UI states; ensure `npx nx test backend` and `npx nx test frontend` pass before opening a PR.

## Commit & Pull Request Guidelines

- Commits: Use present-tense summaries (e.g., `Add Rspack build config`) and limit to ~72 characters. Group related changes per commit when possible.
- Pull Requests: Provide a concise description, reference related issues, list verification commands (`nx test`, `docker-compose up`), and include UI screenshots or API samples when behavior changes.
- Reviews: Highlight risky areas (e.g., Rspack config, Dockerfiles) in the PR description to speed up review cycles.

## Security & Configuration Tips

- Store secrets via environment variables or Docker secrets; never commit `.env` files.
- When exposing new endpoints, document CORS or auth changes in the PR and update `deploy/frontend.nginx.conf` if routes require proxy tweaks.
