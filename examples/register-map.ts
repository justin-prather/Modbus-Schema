/**
 * Demonstrates composing multiple parameters into a register map.
 *
 * This pattern is useful when you have a block of raw holding registers and
 * want to decode them all in one pass, producing a typed snapshot of the
 * device state.
 *
 * @example bun run examples/register-map.ts
 */

import { Brand, Effect, Schema } from "effect";
import {
  makeBitfieldParam,
  makeLookupParam,
  makeScaledParam,
  makeSignedScaledParam,
} from "modbus-schema";

// ── Domain brands ──────────────────────────────────────────────

type FrequencyHz = number & Brand.Brand<"FrequencyHz">;
const FrequencyHz = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(599),
  Schema.brand("FrequencyHz"),
);

type CurrentAmps = number & Brand.Brand<"CurrentAmps">;
const CurrentAmps = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(6553.5),
  Schema.brand("CurrentAmps"),
);

// ── Register addresses ─────────────────────────────────────────

const REG_STATUS = 0x2520;
const REG_FREQUENCY = 0x2522;
const REG_CURRENT = 0x2523;
const REG_TORQUE = 0x2524;
const REG_FAULT = 0x2525;

// ── Register definitions ───────────────────────────────────────

class StatusFlags extends Schema.Class<StatusFlags>("StatusFlags")({
  run: Schema.Boolean,
  fault: Schema.Boolean,
  warning: Schema.Boolean,
}) {}

const status = makeBitfieldParam(
  REG_STATUS,
  StatusFlags,
  { run: 0, fault: 1, warning: 2 } as const,
  { name: "Status", unit: "-", range: "bitfield", default: "0" },
);

const frequency = makeScaledParam<FrequencyHz>(
  REG_FREQUENCY,
  0.01,
  { name: "Output Frequency", unit: "Hz", range: "0.00–599.00", default: "0.00" },
  { domain: FrequencyHz },
);

const current = makeScaledParam<CurrentAmps>(
  REG_CURRENT,
  0.1,
  { name: "Output Current", unit: "A", range: "0.0–6553.5", default: "0.0" },
  { domain: CurrentAmps },
);

const torque = makeSignedScaledParam(
  REG_TORQUE,
  0.1,
  { name: "Torque", unit: "%", range: "–100.0–100.0", default: "0.0" },
);

const faults = makeLookupParam(
  REG_FAULT,
  {
    0: "No fault",
    1: "Over-current",
    2: "Over-voltage",
  } as Record<number, string>,
  (raw) => `Unknown (${raw})`,
  { name: "Fault Code", unit: "-", range: "0-2", default: "0" },
);

// ── Decode a full register snapshot ────────────────────────────

const snapshot: Record<number, number> = {
  [REG_STATUS]: 0b0000_0000_0000_0101, // run=true, fault=true
  [REG_FREQUENCY]: 5000,                // 50.00 Hz
  [REG_CURRENT]: 123,                   // 12.3 A
  [REG_TORQUE]: -500,                   // -50.0%
  [REG_FAULT]: 2,                       // Over-voltage
};

const decodeSnapshot = Effect.gen(function* () {
  return {
    status: yield* status.decode(snapshot[REG_STATUS]),
    frequency: yield* frequency.decode(snapshot[REG_FREQUENCY]),
    current: yield* current.decode(snapshot[REG_CURRENT]),
    torque: yield* torque.decode(snapshot[REG_TORQUE]),
    fault: yield* faults.decode(snapshot[REG_FAULT]),
  };
});

const decoded = Effect.runSync(decodeSnapshot);

console.log("Decoded snapshot:");
console.log("  Status:", {
  run: decoded.status.run,
  fault: decoded.status.fault,
  warning: decoded.status.warning,
});
console.log("  Frequency:", decoded.frequency, "Hz");
console.log("  Current:", decoded.current, "A");
console.log("  Torque:", decoded.torque, "%");
console.log("  Fault:", decoded.fault);

// ── Synchronous snapshot decoding ──────────────────────────────

const syncDecoded = {
  status: status.decodeSync(snapshot[REG_STATUS]),
  frequency: frequency.decodeSync(snapshot[REG_FREQUENCY]),
  current: current.decodeSync(snapshot[REG_CURRENT]),
  torque: torque.decodeSync(snapshot[REG_TORQUE]),
  fault: faults.decodeSync(snapshot[REG_FAULT]),
};

console.log("\nSynchronous snapshot:");
console.log("  Frequency:", syncDecoded.frequency, "Hz");
console.log("  Fault:", syncDecoded.fault);
