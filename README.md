# modbus-schema

**Device-agnostic Effect Schema generators for Modbus register values.** This library produces bidirectional schemas between 16-bit Modbus wire values (`UInt16` / `Int16`) and domain types. Every generator returns both **Effect-native** (`decode` / `encode`) and **synchronous** (`decodeSync` / `encodeSync`) APIs, so the Effect runtime is optional for consumers.

## Install

```sh
bun add modbus-schema
```

Requires `effect` as a peer dependency.

## Quick start

### Effect-native API

```ts
import { Effect } from "effect";
import { makeScaledParam } from "modbus-schema";

const entry = makeScaledParam(0x0102, 0.1, {
  name: "Maximum Output Frequency",
  unit: "Hz",
  range: "4.8~599.0",
  default: "50.0",
});

const program = Effect.gen(function* () {
  const value = yield* entry.decode(500);
  console.log(value); // 50.0
  const wire = yield* entry.encode(60.0);
  console.log(wire); // 600
});

Effect.runSync(program);
```

### Synchronous API

```ts
import { makeScaledParam } from "modbus-schema";

const entry = makeScaledParam(0x0102, 0.1, {
  name: "Maximum Output Frequency",
  unit: "Hz",
  range: "4.8~599.0",
  default: "50.0",
});

const value = entry.decodeSync(500); // 50.0
const wire = entry.encodeSync(60.0); // 600
```

## Factory functions

Each factory returns a `ParamEntry` with `schema`, `decode`, `encode`, `decodeSync`, `encodeSync`, and `formatted`.

| Factory | Description |
|---------|-------------|
| `makeParam(register, meta)` | Simple UInt16 pass-through |
| `makeScaledParam(register, factor, meta)` | Unsigned scaled value |
| `makeSignedScaledParam(register, factor, meta)` | Signed scaled value using two's complement |
| `makeEnumParam(register, labels, meta)` | Enum label ↔ wire integer |
| `makeBitfieldParam(register, flagsClass, bitLayout, meta)` | Boolean flags packed into a word |
| `makeLookupParam(register, labels, fallback, meta)` | Decode-only lookup table with fallback |
| `fromConfig(config)` | Dispatch to the correct factory from a `ParamConfig` |

## Development

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

## License

GPL-3.0
