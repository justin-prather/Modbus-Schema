/**
 * Demonstrates decode/encode error handling in both Effect and sync APIs.
 *
 * The Effect API returns `ParseResult.ParseError` as a typed failure; the sync
 * API throws it. This example shows how to surface, inspect, and recover from
 * invalid wire/domain values.
 *
 * @example bun run examples/error-handling.ts
 */

import { Effect, ParseResult, Schema } from "effect";
import { makeScaledParam } from "modbus-schema";

const Voltage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(10),
  Schema.brand("Voltage"),
);

type Voltage = number & Schema.Schema.Type<typeof Voltage>;

const voltage = makeScaledParam<Voltage>(0x2000, 0.01, {
  name: "DC Bus Voltage",
  unit: "V",
  range: "0.00–10.00",
  default: "0.00",
}, { domain: Voltage });

// ── Effect API: catch failures explicitly ──────────────────────

const handleWithEffect = Effect.gen(function* () {
  const good = yield* voltage.decode(750);
  yield* Effect.sync(() => console.log(`Decoded: ${good} V`));

  const bad = yield* Effect.either(voltage.decode(1500));
  yield* bad.pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.sync(() => console.log("Effect decode failed:", error.message)),
      onSuccess: (value) => Effect.sync(() => console.log("Unexpected:", value)),
    }),
  );

  const invalidDomain = yield* Effect.either(voltage.encode(15 as Voltage));
  yield* invalidDomain.pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.sync(() => console.log("Effect encode failed:", error.message)),
      onSuccess: (value) => Effect.sync(() => console.log("Unexpected wire:", value)),
    }),
  );
});

Effect.runSync(handleWithEffect);

// ── Sync API: catch thrown errors ──────────────────────────────

try {
  voltage.decodeSync(15_000);
} catch (error) {
  if (ParseResult.isParseError(error)) {
    console.log("Sync decode failed:", error.message);
  }
}

try {
  voltage.encodeSync(15 as Voltage);
} catch (error) {
  if (ParseResult.isParseError(error)) {
    console.log("Sync encode failed:", error.message);
  }
}

// ── Round-trip guarantee ───────────────────────────────────────

const roundTrip = Effect.gen(function* () {
  const wire = yield* voltage.encode(7.5 as Voltage);
  const decoded = yield* voltage.decode(wire);
  console.log("Round-trip:", decoded, "V (wire:", wire, ")");
});

Effect.runSync(roundTrip);
