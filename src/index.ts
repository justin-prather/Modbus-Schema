/**
 * @fileoverview Device-agnostic Modbus register schema factories and type definitions.
 *
 * Provides six schema factories ({@link makeParam}, {@link makeScaledParam},
 * {@link makeSignedScaledParam}, {@link makeEnumParam}, {@link makeBitfieldParam},
 * {@link makeLookupParam}) that produce decode/encode/format bundles from a
 * register address and metadata. The {@link fromConfig} overload selects the
 * correct factory based on the {@link ParamConfig} discriminant.
 *
 * Every factory returns a {@link ParamEntry} exposing both Effect-native
 * (`decode` / `encode`) and synchronous (`decodeSync` / `encodeSync`) operations,
 * so consumers are not required to run the Effect runtime.
 *
 * The engine is device-agnostic: it never names domain brands, register enums,
 * or device error types. Domain schemas are passed in via the `domain` field on
 * scaled/lookup configs; the read-only encoder is owned here so monitor registers
 * can share the same primitives as command registers.
 *
 * @module
 */

import { Brand, Effect, ParseResult, Pretty, Schema } from "effect";

// ── Wire primitives ─────────────────────────────────────────

/**
 * Branded 16-bit unsigned word for Modbus register values.
 */
export type UInt16 = number & Brand.Brand<"UInt16">;

export const UInt16 = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(0xffff),
  Schema.brand("UInt16"),
);

/**
 * Branded 16-bit signed word for Modbus register values.
 */
export type Int16 = number & Brand.Brand<"Int16">;

export const Int16 = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(-0x8000),
  Schema.lessThanOrEqualTo(0x7fff),
  Schema.brand("Int16"),
);

// ── Read-only encoder ──────────────────────────────────────

/**
 * Constructs a failure `Effect` for monitor registers that cannot be written.
 *
 * Monitor registers are read-only. Calling `encode()` on a read-only schema
 * fails with a `ParseResult.Type` error whose message indicates the register
 * is read-only.
 *
 * @param registerName - Human-readable name of the register.
 * @param actual - The value that was passed during encode.
 * @param ast - The Effect `AST` describing the expected type.
 */
export const readOnlyEncodeFailure = (
  registerName: string,
  actual: unknown,
  ast: ConstructorParameters<typeof ParseResult.Type>[0],
) =>
  Effect.fail(
    new ParseResult.Type(ast, actual, `${registerName} is read only`),
  );

const bit = (n: number): number => 1 << n;

// ── Metadata ───────────────────────────────────────────────

/**
 * Generic, device-agnostic register metadata used by the engine's description
 * annotations. Extend this interface to add device-specific fields; any extra
 * keys not in {@link RegisterMeta} are rendered automatically in the schema
 * description (e.g. `code: "00-41"` becomes a "Code: 00-41" line).
 */
export interface RegisterMeta {
  readonly name: string;
  readonly unit: string;
  readonly range?: string;
  readonly default?: string;
  readonly description?: string;
}

const REGISTER_META_KEYS = new Set([
  "name",
  "unit",
  "range",
  "default",
  "description",
]);

const formatExtraLines = (meta: RegisterMeta): string[] => {
  const lines: string[] = [];
  for (const key of Object.keys(meta)) {
    if (!REGISTER_META_KEYS.has(key)) {
      const value = (meta as unknown as Record<string, unknown>)[key];
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      lines.push(`${label}: ${value}`);
    }
  }
  return lines;
};

const formatRegister = (register: number): string =>
  `0x${register.toString(16).toUpperCase().padStart(4, "0")}`;

const formatMeta = (register: number, meta: RegisterMeta): string =>
  [
    meta.name,
    `Register: ${formatRegister(register)}`,
    `Setting Range: ${meta.range}`,
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`,
    ...formatExtraLines(meta),
  ].join("\n");

const formatScaledMeta = (
  register: number,
  meta: RegisterMeta,
  factor: number,
): string =>
  [
    meta.name,
    `Register: ${formatRegister(register)}`,
    `Wire format: raw × ${factor}`,
    `Setting Range: ${meta.range}`,
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`,
    ...formatExtraLines(meta),
  ].join("\n");

const formatEnumMeta = (
  register: number,
  meta: RegisterMeta,
  labels: Record<number, string>,
): string =>
  [
    meta.name,
    `Register: ${formatRegister(register)}`,
    `Options:`,
    ...Object.entries(labels).map(([k, v]) => `  ${k} = ${v}`),
    `Default: ${meta.default}`,
    `Unit: ${meta.unit}`,
    ...formatExtraLines(meta),
  ].join("\n");

const formatBitfieldMeta = (register: number, meta: RegisterMeta): string =>
  formatMeta(register, meta);

const formatLookupMeta = (register: number, meta: RegisterMeta): string =>
  formatMeta(register, meta);

// ── Convenience helpers ────────────────────────────────────

const makeEntry = <S extends Schema.Schema<any, any>>(
  schema: S,
): ParamEntry<S> => ({
  schema,
  decode: Schema.decodeUnknown(schema),
  encode: Schema.encode(schema),
  formatted: Pretty.make(schema),
  decodeSync: Schema.decodeUnknownSync(schema),
  encodeSync: Schema.encodeSync(schema),
});

// ── ParamKind enum ─────────────────────────────────────────

/**
 * Identifies which schema factory created/would create the ParamEntry.
 */
export enum ParamKind {
  UInt16 = "UInt16",
  Scaled = "Scaled",
  SignedScaled = "SignedScaled",
  Enum = "Enum",
  Bitfield = "Bitfield",
  Lookup = "Lookup",
}

// ── Config object types ──────────────────────────────────────

/**
 * Base shared by all config variants.
 */
export interface ConfigBase<R extends RegisterMeta = RegisterMeta> {
  readonly register: number;
  readonly kind: ParamKind;
  readonly meta: R;
}

export interface UInt16ParamConfig<R extends RegisterMeta = RegisterMeta>
  extends ConfigBase<R> {
  readonly kind: ParamKind.UInt16;
  readonly readOnly?: boolean;
}

export interface ScaledParamConfig<
  R extends RegisterMeta = RegisterMeta,
  A = number,
> extends ConfigBase<R> {
  readonly kind: ParamKind.Scaled;
  readonly factor: number;
  readonly domain?: Schema.Schema<A, any, any>;
  readonly readOnly?: boolean;
}

export interface SignedScaledParamConfig<
  R extends RegisterMeta = RegisterMeta,
  A = number,
> extends ConfigBase<R> {
  readonly kind: ParamKind.SignedScaled;
  readonly factor: number;
  readonly domain?: Schema.Schema<A, any, any>;
  readonly readOnly?: boolean;
}

export interface EnumParamConfig<
  R extends RegisterMeta = RegisterMeta,
  Domain extends string = string,
> extends ConfigBase<R> {
  readonly kind: ParamKind.Enum;
  readonly labels: Record<number, Domain>;
  readonly readOnly?: boolean;
}

export interface BitfieldParamConfig<
  R extends RegisterMeta = RegisterMeta,
  F extends AnyBitfieldClass = AnyBitfieldClass,
> extends ConfigBase<R> {
  readonly kind: ParamKind.Bitfield;
  readonly flagsClass: F;
  readonly bitLayout: Record<keyof InstanceType<F>, number>;
  readonly readOnly?: boolean;
}

export interface LookupParamConfig<
  R extends RegisterMeta = RegisterMeta,
  Domain extends string = string,
> extends ConfigBase<R> {
  readonly kind: ParamKind.Lookup;
  readonly labels: Record<number, Domain>;
  readonly fallback: (raw: number) => Domain;
  readonly domain?: Schema.Schema<Domain, any, any>;
}

export type ParamConfig<R extends RegisterMeta = RegisterMeta> =
  | UInt16ParamConfig<R>
  | ScaledParamConfig<R, any>
  | SignedScaledParamConfig<R, any>
  | EnumParamConfig<R, any>
  | BitfieldParamConfig<R, any>
  | LookupParamConfig<R, any>;

// ── Bundle entry type ───────────────────────────────────────

type SchemaType<S> = S extends Schema.Schema<infer A, any, any> ? A : never;
type SchemaEncoded<S> = S extends Schema.Schema<any, infer I, any> ? I : never;

export type ParamEntry<S extends Schema.Schema<any, any>> = {
  readonly schema: S;
  readonly decode: (
    raw: unknown,
  ) => Effect.Effect<SchemaType<S>, ParseResult.ParseError, never>;
  readonly encode: (
    value: SchemaType<S>,
  ) => Effect.Effect<SchemaEncoded<S>, ParseResult.ParseError, never>;
  readonly formatted: (value: SchemaType<S>) => string;
  readonly decodeSync: (raw: unknown) => SchemaType<S>;
  readonly encodeSync: (value: SchemaType<S>) => SchemaEncoded<S>;
};

export type ParamEntryOfConfig<C extends ParamConfig> =
  C extends ScaledParamConfig<any, infer A>
    ? ParamEntry<Schema.Schema<A, number>>
    : C extends SignedScaledParamConfig<any, infer A>
      ? ParamEntry<Schema.Schema<A, number>>
      : C extends EnumParamConfig<any, infer Domain>
        ? ParamEntry<Schema.Schema<Domain, number>>
        : C extends BitfieldParamConfig<any, infer F>
          ? BitfieldParamEntry<F & AnyBitfieldClass>
          : C extends LookupParamConfig<any, infer Domain>
            ? ParamEntry<Schema.Schema<Domain, number>>
            : ParamEntry<Schema.Schema<number, number>>;

export type ParamValueOfEntry<E extends ParamEntry<any>> =
  E extends ParamEntry<Schema.Schema<infer A, any>> ? A : never;

// ── Schema factories ──────────────────────────────────────

/**
 * Simple UInt16 pass-through parameter.
 * The wire value IS the parameter value (no scaling).
 */
export const makeParam = <A extends number, I extends number>(
  register: number,
  meta: RegisterMeta,
): ParamEntry<Schema.Schema<A, I>> => {
  const schema = UInt16.pipe(
    Schema.annotations({ description: formatMeta(register, meta) }),
  ) as unknown as Schema.Schema<A, I>;
  return makeEntry(schema);
};

/**
 * Scaled parameter where wire = domain / factor.
 * Decode validates through the optional branded `domain` schema so out-of-range
 * wire values fail (strict). Set `readOnly` to make encode fail with
 * {@link readOnlyEncodeFailure} (monitor registers).
 */
export const makeScaledParam = <A = number>(
  register: number,
  factor: number,
  meta: RegisterMeta,
  opts?: {
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
  },
): ParamEntry<Schema.Schema<A, number>> => {
  const domain = (opts?.domain ?? Schema.Number) as unknown as Schema.Schema<
    A,
    A
  >;
  const readOnly = opts?.readOnly ?? false;
  const description = formatScaledMeta(register, meta, factor);
  const schema = UInt16.pipe(
    Schema.annotations({ description }),
    Schema.transformOrFail(domain, {
      decode: (raw: number) => ParseResult.succeed(raw * factor),
      encode: readOnly
        ? (value: A, _, ast) => readOnlyEncodeFailure(meta.name, value, ast)
        : (value: A) =>
            ParseResult.succeed(
              Math.round((value as unknown as number) / factor),
            ),
      strict: false,
    }),
  ) as unknown as Schema.Schema<A, number>;
  return makeEntry(schema);
};

/**
 * Signed scaled parameter where wire = domain / factor, using UInt16 as the
 * wire-side schema with two's-complement conversion (Modbus delivers unsigned
 * 16-bit values). Decode validates through the optional branded `domain`.
 */
export const makeSignedScaledParam = <A = number>(
  register: number,
  factor: number,
  meta: RegisterMeta,
  opts?: {
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
  },
): ParamEntry<Schema.Schema<A, number>> => {
  const domain = (opts?.domain ?? Schema.Number) as unknown as Schema.Schema<
    A,
    A
  >;
  const readOnly = opts?.readOnly ?? false;
  const description = formatScaledMeta(register, meta, factor);
  const schema = UInt16.pipe(
    Schema.annotations({ description }),
    Schema.transformOrFail(domain, {
      decode: (raw: number) => {
        const signed = raw > 0x7fff ? raw - 0x10000 : raw;
        return ParseResult.succeed(signed * factor);
      },
      encode: readOnly
        ? (value: A, _, ast) => readOnlyEncodeFailure(meta.name, value, ast)
        : (value: A) => {
            const raw = Math.round((value as unknown as number) / factor);
            const unsigned = raw < 0 ? raw + 0x10000 : raw;
            return ParseResult.succeed(unsigned);
          },
      strict: false,
    }),
  ) as unknown as Schema.Schema<A, number>;
  return makeEntry(schema);
};

/**
 * Enum selection parameter.
 * Maps wire integers to human-readable labels and back.
 */
export const makeEnumParam = <Domain extends string>(
  register: number,
  labels: Record<number, Domain>,
  meta: RegisterMeta,
  opts?: { readonly readOnly?: boolean },
): ParamEntry<Schema.Schema<Domain, number>> => {
  const values = [...new Set(Object.values(labels))] as [Domain, ...Domain[]];
  const readOnly = opts?.readOnly ?? false;
  const schema = UInt16.pipe(
    Schema.annotations({
      description: formatEnumMeta(
        register,
        meta,
        labels as Record<number, string>,
      ),
    }),
    Schema.transformOrFail(Schema.Literal(...values), {
      decode: (raw: number, _, ast) => {
        const label = labels[raw as number];
        return label !== undefined
          ? ParseResult.succeed(label)
          : ParseResult.fail(
              new ParseResult.Type(
                ast,
                raw,
                `Unknown enum value ${raw} for ${meta.name}`,
              ),
            );
      },
      encode: readOnly
        ? (value: Domain, _, ast) =>
            readOnlyEncodeFailure(meta.name, value, ast)
        : (value: Domain, _, ast) => {
            const entry = Object.entries(labels).find(([, v]) => v === value);
            return entry
              ? ParseResult.succeed(Number(entry[0]))
              : ParseResult.fail(
                  new ParseResult.Type(
                    ast,
                    value,
                    `Invalid value "${value}" for ${meta.name}`,
                  ),
                );
          },
      strict: false,
    }),
  ) as unknown as Schema.Schema<Domain, number>;
  return makeEntry(schema);
};

// ── Bitfield factory ──────────────────────────────────────

/**
 * Minimal structural shape the bitfield factory needs from a
 * {@link Schema.Class}-derived class: it is both a schema (so it can serve as
 * the `to` of a `transformOrFail`) and an instantiable class.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBitfieldClass = new (fields: any) => any;

/**
 * Constructor shape produced for the generated patch class. Allows `new`
 * construction with a partial record of booleans.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPatchClass = new (
  props?: Partial<{ readonly [k: string]: boolean }>,
) => any;

/**
 * A bitfield entry adds a generated `patch` schema (all-optional booleans) and
 * a `merge` function for read-modify-write semantics.
 */
export type BitfieldParamEntry<F extends AnyBitfieldClass> = ParamEntry<
  Schema.Schema<InstanceType<F>, number>
> & {
  readonly patch: AnyPatchClass;
  readonly merge: (
    base: InstanceType<F>,
    patch: Readonly<Record<string, boolean | undefined>>,
  ) => InstanceType<F>;
};

/**
 * Bitfield parameter: maps a 16-bit wire word to/from a boolean-flag
 * {@link Schema.Class}. Honors arbitrary bit positions (gaps allowed).
 *
 * For writable registers, the factory also generates a `Patch` schema
 * (all-optional booleans over the same keys) and a `merge` function suitable
 * for read-modify-write semantics — the device keeps the original `Schema.Class`
 * so its intent constructors (`CommandWordFlags.runForward`, etc.) survive.
 *
 * Pass `readOnly: true` for monitor registers; the encode path then fails with
 * {@link readOnlyEncodeFailure} and patch/merge remain available but unused.
 */
export const makeBitfieldParam = <F extends AnyBitfieldClass>(
  register: number,
  flagsClass: F,
  bitLayout: Record<keyof InstanceType<F>, number>,
  meta: RegisterMeta,
  opts?: { readonly readOnly?: boolean },
): BitfieldParamEntry<F> => {
  const readOnly = opts?.readOnly ?? false;
  const keys = Object.keys(bitLayout) as Array<keyof InstanceType<F>>;
  const layout = bitLayout as unknown as Record<string, number>;
  type Flags = InstanceType<F>;

  const schema = UInt16.pipe(
    Schema.annotations({ description: formatBitfieldMeta(register, meta) }),
    Schema.transformOrFail(
      flagsClass as unknown as Schema.Schema<
        Flags,
        Schema.Schema<Flags, Flags> extends Schema.Schema<any, infer I, any>
          ? I
          : never
      >,
      {
        decode: (word: number) =>
          ParseResult.succeed(
            new (flagsClass as unknown as new (
              f: Record<string, boolean>,
            ) => Flags)(
              Object.fromEntries(
                keys.map((k) => [k, (word & bit(layout[k as string]!)) !== 0]),
              ),
            ),
          ),
        encode: readOnly
          ? (value: Flags, _, ast) =>
              readOnlyEncodeFailure(meta.name, value, ast)
          : (value: Flags, _, ast) => {
              let word = 0;
              for (const k of keys) {
                if ((value as any)[k]) word |= bit(layout[k as string]!);
              }
              return Number.isInteger(word) && word >= 0 && word <= 0xffff
                ? ParseResult.succeed(word)
                : ParseResult.fail(
                    new ParseResult.Type(
                      ast,
                      value,
                      `${meta.name} is out of UInt16 range`,
                    ),
                  );
            },
        strict: false,
      },
    ),
  ) as unknown as Schema.Schema<Flags, number>;

  const patchFields: Record<string, Schema.Struct.Field> = {};
  for (const k of keys)
    patchFields[k as string] = Schema.optional(Schema.Boolean);
  const patchIdentifier = `${
    (flagsClass as { name?: string }).name ?? "Bitfield"
  }Patch`;
  const patchSchema = Schema.Class<any>(patchIdentifier)(
    patchFields as unknown as Schema.Struct.Fields,
  ) as unknown as AnyPatchClass;

  const merge = (
    base: Flags,
    patchObj: Readonly<Record<string, boolean | undefined>>,
  ): Flags => {
    const fields: Record<string, boolean> = {};
    for (const k of keys) {
      const p = patchObj[k as string];
      fields[k as string] = p === undefined ? (base as any)[k] : p;
    }
    return new (flagsClass as unknown as new (
      f: Record<string, boolean>,
    ) => Flags)(fields);
  };

  return {
    ...makeEntry(schema),
    patch: patchSchema,
    merge,
  } as BitfieldParamEntry<F>;
};

// ── Lookup factory ────────────────────────────────────────

/**
 * Lookup parameter: maps a wire integer → branded `Domain` string via a fixed
 * `labels` table, routing unknown codes through a `fallback`. Inherently
 * decode-only (encode always fails with {@link readOnlyEncodeFailure}); use for
 * monitor registers that report fault/alarm/model codes as human-readable text.
 */
export const makeLookupParam = <Domain extends string>(
  register: number,
  labels: Record<number, Domain>,
  fallback: (raw: number) => Domain,
  meta: RegisterMeta,
  opts?: { readonly domain?: Schema.Schema<Domain, any, any> },
): ParamEntry<Schema.Schema<Domain, number>> => {
  const domain = (opts?.domain ?? Schema.String) as unknown as Schema.Schema<
    Domain,
    Domain
  >;
  const schema = UInt16.pipe(
    Schema.annotations({ description: formatLookupMeta(register, meta) }),
    Schema.transformOrFail(domain, {
      decode: (raw: number) =>
        ParseResult.succeed(labels[raw] ?? fallback(raw)),
      encode: (value: Domain, _, ast) =>
        readOnlyEncodeFailure(meta.name, value, ast),
      strict: false,
    }),
  ) as unknown as Schema.Schema<Domain, number>;
  return makeEntry(schema);
};

// ── fromConfig dispatch ──────────────────────────────────────

export function fromConfig<C extends ParamConfig>(
  config: C,
): ParamEntryOfConfig<C>;
export function fromConfig(config: ParamConfig): unknown {
  switch (config.kind) {
    case ParamKind.UInt16:
      return makeParam(config.register, config.meta);
    case ParamKind.Scaled:
      return makeScaledParam(config.register, config.factor, config.meta, {
        domain: config.domain,
        readOnly: config.readOnly,
      });
    case ParamKind.SignedScaled:
      return makeSignedScaledParam(
        config.register,
        config.factor,
        config.meta,
        {
          domain: config.domain,
          readOnly: config.readOnly,
        },
      );
    case ParamKind.Enum:
      return makeEnumParam(config.register, config.labels, config.meta, {
        readOnly: config.readOnly,
      });
    case ParamKind.Bitfield:
      return makeBitfieldParam(
        config.register,
        config.flagsClass,
        config.bitLayout,
        config.meta,
        { readOnly: config.readOnly },
      );
    case ParamKind.Lookup:
      return makeLookupParam(
        config.register,
        config.labels,
        config.fallback,
        config.meta,
        {
          domain: config.domain,
        },
      );
    default:
      return undefined;
  }
}
