# modbus-schema

Device-agnostic Effect Schema generators for Modbus register values.

This library produces bidirectional schemas between 16-bit Modbus wire values (`UInt16` / `Int16`) and domain types. Every generator returns both **Effect-native** (`decode` / `encode`) and **synchronous** (`decodeSync` / `encodeSync`) APIs, so the Effect runtime is optional for consumers.

## Stack

- **Runtime**: Bun
- **Language**: TypeScript 6 (ESNext, `verbatimModuleSyntax`, bundler resolution, `module: "Preserve"`)
- **Core lib**: `effect` (^3.21.4)
- **License**: GPL-3.0

## Install

```bash
bun install modbus-schema
```

## Usage

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

## Examples

Run any example with `bun run examples/<name>.ts`:

- `examples/basic.ts` — Effect + synchronous API usage
- `examples/branded-types.ts` — domain brands with scaled/signed parameters
- `examples/from-config.ts` — declarative `ParamConfig` dispatch via `fromConfig`
- `examples/bitfield-flags.ts` — read-modify-write flag registers
- `examples/lookup-table.ts` — decode-only fault/alarm code lookups
- `examples/register-map.ts` — compose multiple entries into a typed snapshot
- `examples/error-handling.ts` — parse error handling in Effect and sync APIs

## Factory functions

- `makeParam` — simple UInt16 pass-through
- `makeScaledParam` — unsigned scaled value
- `makeSignedScaledParam` — signed scaled value using two's complement
- `makeEnumParam` — enum label ↔ wire integer
- `makeBitfieldParam` — boolean flags packed into a word
- `makeLookupParam` — decode-only lookup table with fallback
- `fromConfig` — dispatch to the correct factory from a `ParamConfig`

See `src/index.ts` for full type definitions and documentation.
