/**
 * Demonstrates decode-only lookup parameters with fallback handling.
 *
 * `makeLookupParam` maps wire integer codes to human-readable strings. Unknown
 * codes route through a fallback function instead of failing, which is useful
 * for fault/alarm/model registers that may gain new codes over time.
 *
 * @example bun run examples/lookup-table.ts
 */

import { Brand, Schema } from "effect";
import { makeLookupParam } from "modbus-schema";

// ── Branded lookup domain ──────────────────────────────────────

type FaultCode = string & Brand.Brand<"FaultCode">;
const FaultCode = Schema.String.pipe(Schema.brand("FaultCode"));

// ── Fault code lookup table ────────────────────────────────────

const faultLabels: Record<number, FaultCode> = {
  0: "No fault" as FaultCode,
  1: "Over-current" as FaultCode,
  2: "Over-voltage" as FaultCode,
  3: "Under-voltage" as FaultCode,
  4: "Over-temperature" as FaultCode,
};

const faults = makeLookupParam(
  0x2521,
  faultLabels,
  (raw) => `Unknown fault code ${raw}` as FaultCode,
  {
    name: "Fault Code Register",
    unit: "-",
    range: "0–4",
    default: "0",
  },
  { domain: FaultCode },
);

// ── Decode known and unknown codes ─────────────────────────────

for (const wire of [0, 2, 4, 99]) {
  console.log(`Wire ${wire} ->`, faults.decodeSync(wire));
}

// Known: 0 -> No fault
// Known: 2 -> Over-voltage
// Known: 4 -> Over-temperature
// Unknown: 99 -> Unknown fault code 99

// ── Encode intentionally fails (lookup is decode-only) ───────────

try {
  faults.encodeSync("No fault" as FaultCode);
} catch (err) {
  console.log("Encode failed as expected:", (err as Error).message.includes("read only"));
}
