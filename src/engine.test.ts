import { Effect, ParseResult, Schema } from "effect";
import { describe, expect, it } from "bun:test";
import * as P from "./index";

// ── Helpers ────────────────────────────────────────────────────

const decodeOk = (decode: any, wire: number): any =>
  Effect.runSync(decode(wire));

const decodeFail = (decode: any, wire: number): void => {
  expect(() => Effect.runSync(decode(wire))).toThrow();
};

const encodeOk = (encode: any, value: any): number =>
  Effect.runSync(encode(value)) as number;

const encodeFail = (encode: any, value: any): void => {
  expect(() => Effect.runSync(encode(value))).toThrow();
};

const roundTrip = <A>(
  entry: P.ParamEntry<Schema.Schema<A, number>>,
  value: A,
  wire: number,
) => {
  const decoded = decodeOk(entry.decode, wire);
  expect(decoded).toBe(value);
  const encoded = encodeOk(entry.encode, value);
  expect(encoded).toBe(wire);
};

const findDescription = (ast: unknown): string | undefined => {
  if (!ast || typeof ast !== "object") return undefined;
  const n = ast as Record<string, unknown>;
  if (n.annotations) {
    const ann = n.annotations as Record<symbol, unknown>;
    const sym = Object.getOwnPropertySymbols(ann).find(
      (s) => s.description?.includes("Description"),
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

// ── UInt16 param ───────────────────────────────────────────────

describe("UInt16Param", () => {
  const meta: P.RegisterMeta = {
    name: "User Parameter 0",
    range: "00-01~22-31", default: "00-41", unit: "-",
  };

  const config: P.UInt16ParamConfig = {
    register: 0x0029, kind: P.ParamKind.UInt16, meta,
  };

  const entry = P.fromConfig(config) as P.ParamEntry<Schema.Schema<number, number>>;

  it("decodes valid values", () => {
    expect(decodeOk(entry.decode, 0)).toBe(0);
    expect(decodeOk(entry.decode, 1)).toBe(1);
    expect(decodeOk(entry.decode, 65535)).toBe(65535);
  });

  it("rejects negative values", () => {
    decodeFail(entry.decode, -1);
  });

  it("rejects non-integers", () => {
    decodeFail(entry.decode, 1.5);
  });

  it("encodes values within range", () => {
    expect(encodeOk(entry.encode, 0)).toBe(0);
    expect(encodeOk(entry.encode, 1)).toBe(1);
    expect(encodeOk(entry.encode, 65535)).toBe(65535);
  });

  it("round-trips", () => {
    roundTrip(entry, 0, 0);
    roundTrip(entry, 42, 42);
    roundTrip(entry, 65535, 65535);
  });

  it("has formatted description", () => {
    const formatted = entry.formatted;
    expect(typeof formatted).toBe("function");
  });

  it("decodeSync matches Effect decode", () => {
    expect(entry.decodeSync(0)).toBe(0);
    expect(entry.decodeSync(42)).toBe(42);
    expect(entry.decodeSync(65535)).toBe(65535);
  });

  it("encodeSync matches Effect encode", () => {
    expect(entry.encodeSync(0)).toBe(0);
    expect(entry.encodeSync(42)).toBe(42);
    expect(entry.encodeSync(65535)).toBe(65535);
  });

  it("decodeSync throws on invalid input", () => {
    expect(() => entry.decodeSync(-1)).toThrow(ParseResult.ParseError);
  });
});

// ── Scaled param ───────────────────────────────────────────────

describe("ScaledParam", () => {
  const meta: P.RegisterMeta = {
    name: "Maximum Output Frequency of Motor 1",
    range: "4.8~599.0", default: "50.0/60.0", unit: "Hz",
  };

  const config: P.ScaledParamConfig = {
    register: 0x0102, kind: P.ParamKind.Scaled, factor: 0.1, meta,
  };

  const entry = P.fromConfig(config) as P.ParamEntry<Schema.Schema<number, number>>;

  it("decodes wire → scaled value", () => {
    expect(decodeOk(entry.decode, 0)).toBe(0);
    expect(decodeOk(entry.decode, 500)).toBe(50.0);
    expect(decodeOk(entry.decode, 600)).toBe(60.0);
    expect(decodeOk(entry.decode, 10)).toBe(1.0);
  });

  it("encodes scaled value → wire", () => {
    expect(encodeOk(entry.encode, 0)).toBe(0);
    expect(encodeOk(entry.encode, 50.0)).toBe(500);
    expect(encodeOk(entry.encode, 60.0)).toBe(600);
  });

  it("round-trips typical values", () => {
    roundTrip(entry, 50.0, 500);
    roundTrip(entry, 0, 0);
    roundTrip(entry, 599.0, 5990);
  });

  it("rejects negative wire values since backed by UInt16", () => {
    decodeFail(entry.decode, -1);
  });

  it("sync APIs round-trip", () => {
    expect(entry.decodeSync(500)).toBe(50.0);
    expect(entry.encodeSync(50.0)).toBe(500);
  });
});

// ── SignedScaled param ─────────────────────────────────────────

describe("SignedScaledParam", () => {
  const meta: P.RegisterMeta = {
    name: "Pulse Input Bias",
    range: "-100.0~100.0", default: "0.0", unit: "%",
  };

  const config: P.SignedScaledParamConfig = {
    register: 0x0321, kind: P.ParamKind.SignedScaled, factor: 0.1, meta,
  };

  const entry = P.fromConfig(config) as P.ParamEntry<Schema.Schema<number, number>>;

  it("decodes positive wire values", () => {
    expect(decodeOk(entry.decode, 0)).toBe(0);
    expect(decodeOk(entry.decode, 1000)).toBe(100.0);
    expect(decodeOk(entry.decode, 500)).toBe(50.0);
  });

  it("decodes negative wire values via two's complement", () => {
    expect(decodeOk(entry.decode, 65036)).toBe(-50.0); // 0xFE0C
    expect(decodeOk(entry.decode, 64536)).toBe(-100.0); // 0xFC18
  });

  it("encodes positive values", () => {
    expect(encodeOk(entry.encode, 0)).toBe(0);
    expect(encodeOk(entry.encode, 50.0)).toBe(500);
    expect(encodeOk(entry.encode, 100.0)).toBe(1000);
  });

  it("encodes negative values", () => {
    expect(encodeOk(entry.encode, -50.0)).toBe(65036); // 0xFE0C
    expect(encodeOk(entry.encode, -100.0)).toBe(64536); // 0xFC18
  });

  it("round-trips positive and negative", () => {
    roundTrip(entry, 0, 0);
    roundTrip(entry, 50.0, 500);
    roundTrip(entry, -50.0, 65036); // 0xFE0C
  });

  it("sync APIs handle negative values", () => {
    expect(entry.decodeSync(65036)).toBe(-50.0); // 0xFE0C
    expect(entry.encodeSync(-50.0)).toBe(65036); // 0xFE0C
  });
});

// ── Enum param ─────────────────────────────────────────────────

describe("EnumParam", () => {
  const meta: P.RegisterMeta = {
    name: "Control Mode Selection",
    range: "0-6", default: "0", unit: "-",
  };

  const config: P.EnumParamConfig<"V/F" | "V/F+PG" | "SLV" | "SV" | "PMSV" | "PMSLV" | "SLV2"> = {
    register: 0x0000, kind: P.ParamKind.Enum,
    labels: { 0: "V/F", 1: "V/F+PG", 2: "SLV", 3: "SV", 4: "PMSV", 5: "PMSLV", 6: "SLV2" } as const,
    meta,
  };

  const entry = P.fromConfig(config) as P.ParamEntry<
    Schema.Schema<"V/F" | "V/F+PG" | "SLV" | "SV" | "PMSV" | "PMSLV" | "SLV2", number>
  >;

  it("decodes known wire values → label", () => {
    expect(decodeOk(entry.decode, 0)).toBe("V/F");
    expect(decodeOk(entry.decode, 1)).toBe("V/F+PG");
    expect(decodeOk(entry.decode, 6)).toBe("SLV2");
  });

  it("rejects unknown wire values on decode", () => {
    decodeFail(entry.decode, 99);
  });

  it("encodes known label → wire", () => {
    expect(encodeOk(entry.encode, "V/F")).toBe(0);
    expect(encodeOk(entry.encode, "SLV")).toBe(2);
    expect(encodeOk(entry.encode, "SLV2")).toBe(6);
  });

  it("rejects invalid label on encode", () => {
    encodeFail(entry.encode, "INVALID" as any);
  });

  it("sync APIs round-trip enum values", () => {
    expect(entry.decodeSync(3)).toBe("SV");
    expect(entry.encodeSync("PMSV")).toBe(4);
  });

  it("decodeSync throws on unknown enum value", () => {
    expect(() => entry.decodeSync(99)).toThrow(ParseResult.ParseError);
  });
});

// ── Bitfield param ─────────────────────────────────────────────

describe("BitfieldParam", () => {
  class TestFlags extends Schema.Class<TestFlags>("TestFlags")({
    run: Schema.Boolean,
    reverse: Schema.Boolean,
  }) {}

  const layout = { run: 0, reverse: 1 } as const;
  const meta: P.RegisterMeta = {
    name: "Test Command", unit: "-", range: "bitfield", default: "0",
  };

  const entry = P.makeBitfieldParam(0x2501, TestFlags, layout, meta);

  it("decodes bit positions to flags", () => {
    const flags = decodeOk(entry.decode, 0b01);
    expect(flags.run).toBe(true);
    expect(flags.reverse).toBe(false);
  });

  it("encodes flags to bit positions", () => {
    expect(encodeOk(entry.encode, new TestFlags({ run: true, reverse: false }))).toBe(0b01);
    expect(encodeOk(entry.encode, new TestFlags({ run: false, reverse: true }))).toBe(0b10);
  });

  it("round-trips", () => {
    for (const word of [0, 0b01, 0b10, 0b11]) {
      const decoded = decodeOk(entry.decode, word);
      expect(encodeOk(entry.encode, decoded)).toBe(word);
    }
  });

  it("patch and merge work", () => {
    const base = new TestFlags({ run: true, reverse: false });
    const patch = new entry.patch({ reverse: true });
    const merged = entry.merge(base, patch);
    expect(merged.run).toBe(true);
    expect(merged.reverse).toBe(true);
  });

  it("decodeSync matches Effect decode", () => {
    const flags = entry.decodeSync(0b11);
    expect(flags.run).toBe(true);
    expect(flags.reverse).toBe(true);
  });

  it("encodeSync matches Effect encode", () => {
    expect(entry.encodeSync(new TestFlags({ run: true, reverse: true }))).toBe(0b11);
  });
});

// ── Lookup param ───────────────────────────────────────────────

describe("LookupParam", () => {
  const meta: P.RegisterMeta = {
    name: "Error Lookup", unit: "-", range: "0-2", default: "0",
  };

  const entry = P.makeLookupParam(
    0x2521,
    { 1: "UV", 2: "OC" } as Record<number, string>,
    (raw) => `Unknown (${raw})`,
    meta,
  );

  it("decodes known codes", () => {
    expect(decodeOk(entry.decode, 1)).toBe("UV");
    expect(decodeOk(entry.decode, 2)).toBe("OC");
  });

  it("falls back for unknown codes", () => {
    expect(decodeOk(entry.decode, 99)).toBe("Unknown (99)");
  });

  it("encode fails with read-only error", () => {
    encodeFail(entry.encode, "UV" as any);
  });

  it("decodeSync matches Effect decode", () => {
    expect(entry.decodeSync(2)).toBe("OC");
    expect(entry.decodeSync(99)).toBe("Unknown (99)");
  });

  it("encodeSync throws with read-only error", () => {
    expect(() => entry.encodeSync("UV" as any)).toThrow(ParseResult.ParseError);
  });
});

// ── fromConfig dispatch ────────────────────────────────────────

describe("fromConfig", () => {
  it("returns undefined for unknown ParamKind", () => {
    const config = { register: 0, kind: "Unknown", meta: {} } as any;
    expect(P.fromConfig(config)).toBeUndefined();
  });

  it("returns entry with schema, decode, encode, formatted, decodeSync, encodeSync", () => {
    const entry = P.fromConfig({
      register: 0, kind: P.ParamKind.UInt16,
      meta: { name: "Test", range: "-", default: "-", unit: "-" },
    });
    expect(entry).toHaveProperty("schema");
    expect(entry).toHaveProperty("decode");
    expect(entry).toHaveProperty("encode");
    expect(entry).toHaveProperty("formatted");
    expect(entry).toHaveProperty("decodeSync");
    expect(entry).toHaveProperty("encodeSync");
  });
});

// ── Extended metadata ──────────────────────────────────────────

describe("extended metadata", () => {
  it("renders extra RegisterMeta keys in the schema description", () => {
    const extended = {
      name: "PID Gain",
      range: "0–100",
      default: "1",
      unit: "%",
      code: "03-47",
      group: 3,
      page: 431,
    };

    const entry = P.makeScaledParam(0x0347, 0.01, extended);

    const desc = findDescription(entry.schema.ast);
    expect(desc).toContain("Code: 03-47");
    expect(desc).toContain("Group: 3");
    expect(desc).toContain("Page: 431");
    expect(desc).not.toContain("Description:"); // description is in REGISTER_META_KEYS
  });

  it("works with all factory types (UInt16, Enum, Lookup)", () => {
    const meta = {
      name: "Test",
      range: "0-1",
      default: "0",
      unit: "-",
      serial: "A100",
    };

    const uint16 = P.makeParam(0x1000, meta);
    const desc1 = findDescription(uint16.schema.ast);
    expect(desc1).toContain("Serial: A100");

    const enumEntry = P.makeEnumParam(0x1001, { 0: "Off", 1: "On" }, meta);
    const desc2 = findDescription(enumEntry.schema.ast);
    expect(desc2).toContain("Serial: A100");

    const lookupEntry = P.makeLookupParam(
      0x1002, { 1: "FaultA" }, (r) => `Unknown(${r})`, meta,
    );
    const desc3 = findDescription(lookupEntry.schema.ast);
    expect(desc3).toContain("Serial: A100");
  });

  it("works with fromConfig", () => {
    const meta = {
      name: "Config Test",
      range: "0-255",
      default: "0",
      unit: "-",
      vendorId: "0xACME",
    };

    const entry = P.fromConfig({
      register: 0x2000,
      kind: P.ParamKind.UInt16,
      meta,
    });

    const desc = findDescription((entry as any).schema.ast);
    expect(desc).toContain("VendorId: 0xACME");
  });

  it("includes extra fields in description of readOnly params", () => {
    const meta = {
      name: "Monitor Register",
      range: "0-1",
      default: "0",
      unit: "-",
      alarm: "Overheat",
    };

    const entry = P.makeScaledParam(0x3000, 1, meta, { readOnly: true });

    const desc = findDescription(entry.schema.ast);
    expect(desc).toContain("Alarm: Overheat");
  });
});

// ── ParamKind enum ─────────────────────────────────────────────

describe("ParamKind", () => {
  it("has all six values", () => {
    expect(P.ParamKind.UInt16).toBe("UInt16" as any);
    expect(P.ParamKind.Scaled).toBe("Scaled" as any);
    expect(P.ParamKind.SignedScaled).toBe("SignedScaled" as any);
    expect(P.ParamKind.Enum).toBe("Enum" as any);
    expect(P.ParamKind.Bitfield).toBe("Bitfield" as any);
    expect(P.ParamKind.Lookup).toBe("Lookup" as any);
  });
});

// ── Read-only encode behavior ──────────────────────────────────

describe("readOnly encode", () => {
  const meta: P.RegisterMeta = {
    name: "Monitor", unit: "-", range: "0-100", default: "0",
  };

  const entry = P.makeScaledParam(0x2520, 0.1, meta, { readOnly: true });

  it("Effect encode fails with read-only message", () => {
    const err = Effect.runSync(Effect.flip(entry.encode(50)));
    expect(err.message || err.toString()).toContain("read only");
  });

  it("encodeSync throws with read-only message", () => {
    expect(() => entry.encodeSync(50)).toThrow();
    try {
      entry.encodeSync(50);
    } catch (err: any) {
      expect(err.message || err.toString()).toContain("read only");
    }
  });
});
