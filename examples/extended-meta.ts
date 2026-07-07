/**
 * Demonstrates extending {@link RegisterMeta} with device-specific fields.
 *
 * Extra keys beyond RegisterMeta's fields are rendered automatically in the
 * schema description (see `formatExtraLines`). Works with both direct factory
 * calls and the declarative {@link fromConfig} dispatch.
 *
 * @example bun run examples/extended-meta.ts
 */

import {
  ParamKind,
  type RegisterMeta,
  makeScaledParam,
  fromConfig,
} from "../index";

// ── Extended metadata ─────────────────────────────────────────

interface DeviceMeta extends RegisterMeta {
  readonly code: string;
  readonly group: number;
  readonly page: number;
}

// ── Params with extended meta ─────────────────────────────────

const meta: DeviceMeta = {
  code: "03-47",
  name: "PID Feedback Gain",
  range: "0.00–100.00",
  default: "1.00",
  unit: "%",
  group: 3,
  page: 431,
};

const pidGain = makeScaledParam(0x0347, 0.01, meta);

console.log("Decoded value:", pidGain.decodeSync(5000)); // 50
console.log("Encoded wire:", pidGain.encodeSync(75.25)); // 7525

// Extra fields (code, group, page) are rendered in the schema description.
// Walk all AST nodes to find it (annotations live on an inner Refinement).
const findDescription = (node: unknown): string | undefined => {
  if (!node || typeof node !== "object") return undefined;
  const n = node as Record<string, unknown>;
  if (n.annotations) {
    const ann = n.annotations as Record<symbol, unknown>;
    const sym = Object.getOwnPropertySymbols(ann).find((s) =>
      s.description?.includes("Description"),
    );
    if (sym) return String(ann[sym]);
  }
  for (const val of Object.values(n)) {
    if (val && typeof val === "object") {
      const found = findDescription(val);
      if (found) return found;
    }
  }
  return undefined;
};

console.log("\nSchema description:");
console.log(findDescription(pidGain.schema.ast));

// ── Also works with fromConfig ────────────────────────────────

const entry = fromConfig({
  register: 0x0347,
  kind: ParamKind.Scaled,
  factor: 0.01,
  meta,
});

if (entry) {
  console.log(
    "\nfromConfig decode:",
    (entry as typeof pidGain).decodeSync(3000),
  );
}
