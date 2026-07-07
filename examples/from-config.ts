/**
 * Demonstrates declarative register configuration with {@link fromConfig}.
 *
 * Instead of calling factories directly, define a record of {@link ParamConfig}
 * objects and let `fromConfig` dispatch to the correct factory. This pattern
 * mirrors how device parameter groups are defined in the inverter package.
 *
 * @example bun run examples/from-config.ts
 */

import { Schema } from "effect";
import {
  ParamKind,
  type ParamConfig,
  type ScaledParamConfig,
  type SignedScaledParamConfig,
  type EnumParamConfig,
  fromConfig,
} from "modbus-schema";

// ── Domain brand ───────────────────────────────────────────────

const Voltage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(10),
  Schema.brand("Voltage"),
);

type Voltage = number & Schema.Schema.Type<typeof Voltage>;

// ── Declarative register configs ───────────────────────────────

const controlMode = {
  register: 0x0000,
  kind: ParamKind.Enum,
  labels: {
    0: "V/F",
    1: "Sensorless Vector",
    2: "Closed Loop Vector",
  } as const,
  meta: {
    name: "Control Mode Selection",
    range: "0-2",
    default: "0",
    unit: "-",
  },
} satisfies EnumParamConfig;

const analogOutputScale = {
  register: 0x0001,
  kind: ParamKind.Scaled,
  factor: 0.01,
  domain: Voltage,
  meta: {
    name: "Analog Output 1 Scale",
    range: "0.00–10.00",
    default: "0.00",
    unit: "V",
  },
} satisfies ScaledParamConfig<Voltage>;

const pulseInputBias = {
  register: 0x0002,
  kind: ParamKind.SignedScaled,
  factor: 0.1,
  meta: {
    name: "Pulse Input Bias",
    range: "–100.0–100.0",
    default: "0.0",
    unit: "%",
  },
} satisfies SignedScaledParamConfig;

// ── Build entries from configs ─────────────────────────────────

const entries = {
  controlMode: fromConfig(controlMode),
  analogOutputScale: fromConfig(analogOutputScale),
  pulseInputBias: fromConfig(pulseInputBias),
};

// ── Decode a snapshot of raw register values ───────────────────

const snapshot: Record<number, number> = {
  [controlMode.register]: 2,
  [analogOutputScale.register]: 750,
  [pulseInputBias.register]: 65036, // 0xFE0C = -50.0
};

console.log(
  "Control mode:",
  entries.controlMode.decodeSync(snapshot[controlMode.register]),
);
console.log(
  "Analog output scale:",
  entries.analogOutputScale.decodeSync(snapshot[analogOutputScale.register]),
);
console.log(
  "Pulse input bias:",
  entries.pulseInputBias.decodeSync(snapshot[pulseInputBias.register]),
);

// ── Encode a domain value back to wire ─────────────────────────

const wire = entries.analogOutputScale.encodeSync(10 as Voltage);
console.log("Analog output scale wire:", wire); // 1000
