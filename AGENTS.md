# Repository Guidelines

## Project Structure & Module Organization
- The NestJS API lives in `src/`; feature modules (`backtest`, `candles`, `data`, `feed`) expose controllers/services while `aggregation`, `strategy`, and `lib` hold reusable trading logic.
- DTOs and validation classes stay next to their modules (see `src/backtest/dto`); shared types and time helpers sit in `src/types.ts` and `src/time.ts`.
- Tests reside in `tests/strategy`, mirroring runtime namespaces; add new suites beside the code they exercise.
- `data/` ships sample CSVs, whereas `storage/` is runtime-only for uploads, derived datasets, and `data.sqlite`—never commit its contents.

## Build, Test, and Development Commands
- `bun install` syncs dependencies; respect the checked-in `bun.lock` and match the Bun version.
- `bun run api:serve` boots `src/main.ts` on `PORT` (default 3000) with Nest logging enabled.
- `bun run web:dev` spins up the Vite React UI; `bun run web:build` compiles production assets, and `bun run web:preview` serves them.
- `bun test` runs the Bun test runner; filter scope with `bun test tests/strategy/strategy-engine.test.ts` when iterating.

## Coding Style & Naming Conventions
- TypeScript runs in `strict` mode—avoid `any`, lean on helpers under `src/lib`, and wire DTOs through `class-transformer` / `class-validator`.
- Use 2-space indentation, single quotes, and trailing commas; run `bunx prettier --write` before committing.
- Module folders stay kebab- or lower-camel-case (`mother-bar-detector`, `dataLoader.ts`); classes/interfaces are PascalCase, functions and variables camelCase.
- Prefer Bun-native tooling (`Bun.file`, `bun:test`) and keep imports relative within a module boundary.

## Testing Guidelines
- Write tests with `bun:test`; share reusable fixtures under `tests/_support` if they emerge.
- Name files `<feature>.test.ts` and mirror runtime paths so watch mode discovers them.
- Cover happy paths and edge cases (pending setups, dataset activation), grounding timestamps with `parseTimestamp` from `src/time.ts`.
- Stub storage interaction with temporary directories rather than mutating `data/` or `storage/` contents.

## Commit & Pull Request Guidelines
- Commits follow conventional `type(scope): summary` as seen in history (`feat(web): ...`, `refactor: ...`), written in the imperative.
- Keep each commit focused and mention relevant Bun commands in the body when behaviour shifts.
- PRs should explain motivation, list API/UI impacts, link issues, and add screenshots or logs for UX or data changes.
- Confirm formatting, `bun test`, and `bun run web:build` (if UI touched); call out any skipped checks.
