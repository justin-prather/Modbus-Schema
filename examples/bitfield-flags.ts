/**
 * Demonstrates bitfield parameters with read-modify-write semantics.
 *
 * `makeBitfieldParam` packs boolean flags into a 16-bit word and generates a
 * `Patch` class plus `merge` function so consumers can update only the bits
 * they care about.
 *
 * @example bun run examples/bitfield-flags.ts
 */

import { Schema } from "effect";
import { makeBitfieldParam } from "../index";

// ── Flag class ─────────────────────────────────────────────────

class StatusFlags extends Schema.Class<StatusFlags>("StatusFlags")({
  run: Schema.Boolean,
  reverse: Schema.Boolean,
  fault: Schema.Boolean,
  warning: Schema.Boolean,
}) {}

const statusLayout = {
  run: 0,
  reverse: 1,
  fault: 2,
  warning: 3,
} as const satisfies Record<keyof StatusFlags, number>;

// ── Build the bitfield entry ───────────────────────────────────

const status = makeBitfieldParam(0x2520, StatusFlags, statusLayout, {
  name: "Status Register",
  unit: "-",
  range: "bitfield",
  default: "0",
});

// ── Decode a raw word ──────────────────────────────────────────

const decoded = status.decodeSync(0b0000_1010);
console.log("Decoded status:", {
  run: decoded.run,
  reverse: decoded.reverse,
  fault: decoded.fault,
  warning: decoded.warning,
});
// { run: false, reverse: true, fault: true, warning: false }

// ── Read-modify-write: update only the run bit ─────────────────

const current = new StatusFlags({
  run: false,
  reverse: true,
  fault: false,
  warning: false,
});
const patch = new status.patch({ run: true });
const merged = status.merge(current, patch);

console.log("Merged status:", {
  run: merged.run,
  reverse: merged.reverse,
  fault: merged.fault,
  warning: merged.warning,
});
// { run: true, reverse: true, fault: false, warning: false }

const wire = status.encodeSync(merged);
console.log("Encoded wire:", wire.toString(2).padStart(16, "0")); // 0000000000000011
