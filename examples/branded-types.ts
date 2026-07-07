/**
 * Demonstrates domain branding with scaled parameters.
 *
 * Brands constrain the domain type (e.g. FrequencyHz, TorquePercent) while the
 * wire representation stays a plain UInt16. Both Effect and synchronous APIs
 * validate through the branded domain schema.
 *
 * @example bun run examples/branded-types.ts
 */

import { Brand, Effect, Schema } from "effect";
import { makeScaledParam, makeSignedScaledParam } from "modbus-schema";

// ── Domain brands ──────────────────────────────────────────────

export type FrequencyHz = number & Brand.Brand<"FrequencyHz">;
export const FrequencyHz = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(599),
  Schema.brand("FrequencyHz"),
);

export type TorquePercent = number & Brand.Brand<"TorquePercent">;
export const TorquePercent = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(-100),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("TorquePercent"),
);

// ── Branded scaled parameters ──────────────────────────────────

const frequency = makeScaledParam<FrequencyHz>(0x0102, 0.1, {
  name: "Frequency Command",
  unit: "Hz",
  range: "0.00–599.00",
  default: "0.00",
}, { domain: FrequencyHz });

const torque = makeSignedScaledParam<TorquePercent>(0x0103, 1 / 81.92, {
  name: "Torque Command",
  unit: "%",
  range: "–100.0–100.0",
  default: "0.0",
}, { domain: TorquePercent });

// ── Effect API ─────────────────────────────────────────────────

const program = Effect.gen(function* () {
  const hz = yield* frequency.decode(5000);
  yield* Effect.sync(() => console.log(`Frequency: ${hz} Hz`)); // 50.00 Hz

  const pct = yield* torque.decode(-4096);
  yield* Effect.sync(() => console.log(`Torque: ${pct.toFixed(1)}%`)); // -50.0%

  const wire = yield* torque.encode(75 as TorquePercent);
  yield* Effect.sync(() => console.log(`Torque wire: ${wire}`)); // 6144
});

Effect.runSync(program);

// ── Synchronous API ────────────────────────────────────────────

console.log("Sync frequency decode:", frequency.decodeSync(5990)); // 599
console.log("Sync torque decode:", torque.decodeSync(-8192)); // -100

// Out-of-range values are rejected by the branded domain schema.
try {
  frequency.encodeSync(600 as FrequencyHz); // exceeds 599 Hz
} catch (err) {
  console.log("Encode rejected out-of-range frequency:", (err as Error).message);
}
