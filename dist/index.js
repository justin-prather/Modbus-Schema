// src/index.ts
import { Effect, ParseResult, Pretty, Schema } from "effect";
var UInt16 = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.lessThanOrEqualTo(65535), Schema.brand("UInt16"));
var Int16 = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(-32768), Schema.lessThanOrEqualTo(32767), Schema.brand("Int16"));
var readOnlyEncodeFailure = (registerName, actual, ast) => Effect.fail(new ParseResult.Type(ast, actual, `${registerName} is read only`));
var bit = (n) => 1 << n;
var isParamMeta = (m) => ("group" in m) && ("code" in m) && ("page" in m);
var formatRegister = (register) => `0x${register.toString(16).toUpperCase().padStart(4, "0")}`;
var formatMeta = (register, meta) => {
  const head = isParamMeta(meta) ? `${meta.code} ${meta.name}` : meta.name;
  const lines = [
    head,
    `Register: ${formatRegister(register)}`,
    `Setting Range: ${meta.range}`,
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`
  ];
  if (isParamMeta(meta))
    lines.push(`Manual Page: ${meta.page}`);
  return lines.join(`
`);
};
var formatScaledMeta = (register, meta, factor) => {
  const head = isParamMeta(meta) ? `${meta.code} ${meta.name}` : meta.name;
  const lines = [
    head,
    `Register: ${formatRegister(register)}`,
    `Wire format: raw × ${factor}`,
    `Setting Range: ${meta.range}`,
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`
  ];
  if (isParamMeta(meta))
    lines.push(`Manual Page: ${meta.page}`);
  return lines.join(`
`);
};
var formatEnumMeta = (register, meta, labels) => {
  const head = isParamMeta(meta) ? `${meta.code} ${meta.name}` : meta.name;
  const lines = [
    head,
    `Register: ${formatRegister(register)}`,
    `Options:`,
    ...Object.entries(labels).map(([k, v]) => `  ${k} = ${v}`),
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`
  ];
  if (isParamMeta(meta))
    lines.push(`Manual Page: ${meta.page}`);
  return lines.join(`
`);
};
var formatBitfieldMeta = (register, meta) => formatMeta(register, meta);
var formatLookupMeta = (register, meta) => formatMeta(register, meta);
var makeEntry = (schema) => ({
  schema,
  decode: Schema.decodeUnknown(schema),
  encode: Schema.encode(schema),
  formatted: Pretty.make(schema),
  decodeSync: Schema.decodeUnknownSync(schema),
  encodeSync: Schema.encodeSync(schema)
});
var ParamKind;
((ParamKind2) => {
  ParamKind2["UInt16"] = "UInt16";
  ParamKind2["Scaled"] = "Scaled";
  ParamKind2["SignedScaled"] = "SignedScaled";
  ParamKind2["Enum"] = "Enum";
  ParamKind2["Bitfield"] = "Bitfield";
  ParamKind2["Lookup"] = "Lookup";
})(ParamKind ||= {});
var makeParam = (register, meta) => {
  const schema = UInt16.pipe(Schema.annotations({ description: formatMeta(register, meta) }));
  return makeEntry(schema);
};
var makeScaledParam = (register, factor, meta, opts) => {
  const domain = opts?.domain ?? Schema.Number;
  const readOnly = opts?.readOnly ?? false;
  const description = formatScaledMeta(register, meta, factor);
  const schema = UInt16.pipe(Schema.annotations({ description }), Schema.transformOrFail(domain, {
    decode: (raw) => ParseResult.succeed(raw * factor),
    encode: readOnly ? (value, _, ast) => readOnlyEncodeFailure(meta.name, value, ast) : (value) => ParseResult.succeed(Math.round(value / factor)),
    strict: false
  }));
  return makeEntry(schema);
};
var makeSignedScaledParam = (register, factor, meta, opts) => {
  const domain = opts?.domain ?? Schema.Number;
  const readOnly = opts?.readOnly ?? false;
  const description = formatScaledMeta(register, meta, factor);
  const schema = UInt16.pipe(Schema.annotations({ description }), Schema.transformOrFail(domain, {
    decode: (raw) => {
      const signed = raw > 32767 ? raw - 65536 : raw;
      return ParseResult.succeed(signed * factor);
    },
    encode: readOnly ? (value, _, ast) => readOnlyEncodeFailure(meta.name, value, ast) : (value) => {
      const raw = Math.round(value / factor);
      const unsigned = raw < 0 ? raw + 65536 : raw;
      return ParseResult.succeed(unsigned);
    },
    strict: false
  }));
  return makeEntry(schema);
};
var makeEnumParam = (register, labels, meta, opts) => {
  const values = [...new Set(Object.values(labels))];
  const readOnly = opts?.readOnly ?? false;
  const schema = UInt16.pipe(Schema.annotations({
    description: formatEnumMeta(register, meta, labels)
  }), Schema.transformOrFail(Schema.Literal(...values), {
    decode: (raw, _, ast) => {
      const label = labels[raw];
      return label !== undefined ? ParseResult.succeed(label) : ParseResult.fail(new ParseResult.Type(ast, raw, `Unknown enum value ${raw} for ${meta.name}`));
    },
    encode: readOnly ? (value, _, ast) => readOnlyEncodeFailure(meta.name, value, ast) : (value, _, ast) => {
      const entry = Object.entries(labels).find(([, v]) => v === value);
      return entry ? ParseResult.succeed(Number(entry[0])) : ParseResult.fail(new ParseResult.Type(ast, value, `Invalid value "${value}" for ${meta.name}`));
    },
    strict: false
  }));
  return makeEntry(schema);
};
var makeBitfieldParam = (register, flagsClass, bitLayout, meta, opts) => {
  const readOnly = opts?.readOnly ?? false;
  const keys = Object.keys(bitLayout);
  const layout = bitLayout;
  const schema = UInt16.pipe(Schema.annotations({ description: formatBitfieldMeta(register, meta) }), Schema.transformOrFail(flagsClass, {
    decode: (word) => ParseResult.succeed(new flagsClass(Object.fromEntries(keys.map((k) => [k, (word & bit(layout[k])) !== 0])))),
    encode: readOnly ? (value, _, ast) => readOnlyEncodeFailure(meta.name, value, ast) : (value, _, ast) => {
      let word = 0;
      for (const k of keys) {
        if (value[k])
          word |= bit(layout[k]);
      }
      return Number.isInteger(word) && word >= 0 && word <= 65535 ? ParseResult.succeed(word) : ParseResult.fail(new ParseResult.Type(ast, value, `${meta.name} is out of UInt16 range`));
    },
    strict: false
  }));
  const patchFields = {};
  for (const k of keys)
    patchFields[k] = Schema.optional(Schema.Boolean);
  const patchIdentifier = `${flagsClass.name ?? "Bitfield"}Patch`;
  const patchSchema = Schema.Class(patchIdentifier)(patchFields);
  const merge = (base, patchObj) => {
    const fields = {};
    for (const k of keys) {
      const p = patchObj[k];
      fields[k] = p === undefined ? base[k] : p;
    }
    return new flagsClass(fields);
  };
  return {
    ...makeEntry(schema),
    patch: patchSchema,
    merge
  };
};
var makeLookupParam = (register, labels, fallback, meta, opts) => {
  const domain = opts?.domain ?? Schema.String;
  const schema = UInt16.pipe(Schema.annotations({ description: formatLookupMeta(register, meta) }), Schema.transformOrFail(domain, {
    decode: (raw) => ParseResult.succeed(labels[raw] ?? fallback(raw)),
    encode: (value, _, ast) => readOnlyEncodeFailure(meta.name, value, ast),
    strict: false
  }));
  return makeEntry(schema);
};
function fromConfig(config) {
  switch (config.kind) {
    case "UInt16" /* UInt16 */:
      return makeParam(config.register, config.meta);
    case "Scaled" /* Scaled */:
      return makeScaledParam(config.register, config.factor, config.meta, {
        domain: config.domain,
        readOnly: config.readOnly
      });
    case "SignedScaled" /* SignedScaled */:
      return makeSignedScaledParam(config.register, config.factor, config.meta, {
        domain: config.domain,
        readOnly: config.readOnly
      });
    case "Enum" /* Enum */:
      return makeEnumParam(config.register, config.labels, config.meta, {
        readOnly: config.readOnly
      });
    case "Bitfield" /* Bitfield */:
      return makeBitfieldParam(config.register, config.flagsClass, config.bitLayout, config.meta, { readOnly: config.readOnly });
    case "Lookup" /* Lookup */:
      return makeLookupParam(config.register, config.labels, config.fallback, config.meta, {
        domain: config.domain
      });
    default:
      return;
  }
}
export {
  readOnlyEncodeFailure,
  makeSignedScaledParam,
  makeScaledParam,
  makeParam,
  makeLookupParam,
  makeEnumParam,
  makeBitfieldParam,
  fromConfig,
  UInt16,
  ParamKind,
  Int16
};
