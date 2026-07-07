/**
 * Basic usage of the synchronous and Effect-native decode/encode APIs.
 *
 * Shows a single scaled parameter representing a frequency register.
 *
 * @example bun run examples/basic.ts
 */

import { Effect } from "effect";
import { makeScaledParam } from "../index";

const frequency = makeScaledParam(0x0102, 0.1, {
  name: "Maximum Output Frequency",
  unit: "Hz",
  range: "4.8~599.0",
  default: "50.0",
});

// Effect-native API
const effectProgram = Effect.gen(function* () {
  const hz = yield* frequency.decode(500);
  console.log("Decoded (Effect):", hz); // 50.0

  const wire = yield* frequency.encode(60.0);
  console.log("Encoded (Effect):", wire); // 600
});

Effect.runSync(effectProgram);

// Synchronous API — no Effect runtime required
console.log("Decoded (sync):", frequency.decodeSync(500)); // 50.0
console.log("Encoded (sync):", frequency.encodeSync(60.0)); // 600
