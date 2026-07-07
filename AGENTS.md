# modbus-schema

Device-agnostic Effect Schema generators for Modbus register values, with both Effect-native and synchronous APIs.

## Stack

- **Runtime**: Bun only — never use Node, npm, pnpm, yarn, or vite.
- **Language**: TypeScript 6 (ESNext, `verbatimModuleSyntax`, bundler resolution, `module: "Preserve"`).
- **Core lib**: `effect` (^3.21.4).
- **LSP**: `@effect/language-service` plugin in `tsconfig.json` `compilerOptions.plugins`.
- **License**: GPL-3.0.

## Commands

| Action | Command |
|--------|---------|
| Install | `bun install` |
| Type-check | `bun run typecheck` |
| Test | `bun test` |
| Run example | `bun run examples/<name>.ts` |
| Build | `bun run build` |

No build step required for development — `noEmit` is on; Bun runs `.ts` directly.

## Source layout

```
index.ts                     — Re-exports all public API from src/
src/
  index.ts                   — Schema engine: factories, config types, fromConfig, wire primitives
  engine.test.ts             — Unit tests for all factories and sync APIs
examples/
  basic.ts                   — Effect + synchronous API usage
  branded-types.ts           — Domain brands with scaled/signed parameters
  from-config.ts             — Declarative ParamConfig dispatch via fromConfig
  bitfield-flags.ts          — Read-modify-write flag registers
  lookup-table.ts            — Decode-only fault/alarm code lookups
  register-map.ts            — Compose multiple entries into a typed snapshot
  error-handling.ts          — Parse error handling in Effect and sync APIs
```

## Architecture

- **Wire primitives** — `UInt16` and `Int16` branded schemas enforce Modbus word ranges.
- **Schema factories** — `makeParam`, `makeScaledParam`, `makeSignedScaledParam`, `makeEnumParam`, `makeBitfieldParam`, `makeLookupParam` produce `ParamEntry` bundles.
- **`ParamEntry`** — Contains:
  - `schema` — the Effect `Schema`
  - `decode` / `encode` — Effect-native operations
  - `decodeSync` / `encodeSync` — synchronous operations that throw `ParseResult.ParseError` on failure
  - `formatted` — pretty-print helper
- **`BitfieldParamEntry`** — Extends `ParamEntry` with a generated `Patch` class and `merge` function for read-modify-write semantics.
- **`ParamConfig` / `ParamKind`** — Discriminated config objects consumed by `fromConfig`.
- **`RegisterMeta` / `ParamMeta`** — Metadata used for description annotations. `ParamMeta` extends `RegisterMeta` with group/code/page fields for device parameter manuals.

The engine is intentionally device-agnostic: it never imports domain brands, register enums, or device error types.

## Conventions

- Follow `effect` idioms: `Schema`, `Brand`, `ParseResult`, `Pretty`.
- Use `Bun.test` / `import { test, expect } from "bun:test"` for tests.
- Always `import type` for type-only imports (`verbatimModuleSyntax`).
- Sync APIs use Effect Schema's built-in `Schema.decodeUnknownSync` / `Schema.encodeSync` and throw on parse errors.

## Tooling

- **Fallow MCP** is configured via `opencode.json` (`bunx fallow-mcp`). Run `fallow audit` for pre-commit quality checks on changed code.

## Referencing upstream libraries

Shallow clones of key dependencies can live in `references/` for offline browsing (gitignored; re-clone if stale):

| Reference | Local path | Useful subdirectory |
|-----------|-----------|-------------------|
| effect | `references/effect` | `packages/effect/src/` for core types |
| effect | `references/effect` | `packages/schema/src/` for Schema APIs |
