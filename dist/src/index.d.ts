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
import { Brand, Effect, ParseResult, Schema } from "effect";
/**
 * Branded 16-bit unsigned word for Modbus register values.
 */
export type UInt16 = number & Brand.Brand<"UInt16">;
export declare const UInt16: Schema.brand<Schema.filter<Schema.filter<Schema.filter<typeof Schema.Number>>>, "UInt16">;
/**
 * Branded 16-bit signed word for Modbus register values.
 */
export type Int16 = number & Brand.Brand<"Int16">;
export declare const Int16: Schema.brand<Schema.filter<Schema.filter<Schema.filter<typeof Schema.Number>>>, "Int16">;
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
export declare const readOnlyEncodeFailure: (registerName: string, actual: unknown, ast: ConstructorParameters<typeof ParseResult.Type>[0]) => Effect.Effect<never, ParseResult.Type, never>;
/**
 * Generic, device-agnostic register metadata used by the engine's description
 * annotations. Extend this interface to add device-specific fields; any extra
 * keys not in {@link RegisterMeta} are rendered automatically in the schema
 * description (e.g. `code: "00-41"` becomes a "Code: 00-41" line).
 */
export interface RegisterMeta {
    readonly name: string;
    readonly unit: string;
    readonly range: string;
    readonly default: string;
    readonly description?: string;
}
/**
 * Identifies which schema factory created/would create the ParamEntry.
 */
export declare enum ParamKind {
    UInt16 = "UInt16",
    Scaled = "Scaled",
    SignedScaled = "SignedScaled",
    Enum = "Enum",
    Bitfield = "Bitfield",
    Lookup = "Lookup"
}
/**
 * Base shared by all config variants.
 */
export interface ConfigBase<R extends RegisterMeta = RegisterMeta> {
    readonly register: number;
    readonly kind: ParamKind;
    readonly meta: R;
}
export interface UInt16ParamConfig extends ConfigBase {
    readonly kind: ParamKind.UInt16;
    readonly readOnly?: boolean;
}
export interface ScaledParamConfig<A = number> extends ConfigBase {
    readonly kind: ParamKind.Scaled;
    readonly factor: number;
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
}
export interface SignedScaledParamConfig<A = number> extends ConfigBase {
    readonly kind: ParamKind.SignedScaled;
    readonly factor: number;
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
}
export interface EnumParamConfig<Domain extends string = string> extends ConfigBase {
    readonly kind: ParamKind.Enum;
    readonly labels: Record<number, Domain>;
    readonly readOnly?: boolean;
}
export interface BitfieldParamConfig<F extends AnyBitfieldClass = AnyBitfieldClass> extends ConfigBase {
    readonly kind: ParamKind.Bitfield;
    readonly flagsClass: F;
    readonly bitLayout: Record<keyof InstanceType<F>, number>;
    readonly readOnly?: boolean;
}
export interface LookupParamConfig<Domain extends string = string> extends ConfigBase {
    readonly kind: ParamKind.Lookup;
    readonly labels: Record<number, Domain>;
    readonly fallback: (raw: number) => Domain;
    readonly domain?: Schema.Schema<Domain, any, any>;
}
export type ParamConfig = UInt16ParamConfig | ScaledParamConfig<any> | SignedScaledParamConfig<any> | EnumParamConfig<any> | BitfieldParamConfig<any> | LookupParamConfig<any>;
type SchemaType<S> = S extends Schema.Schema<infer A, any, any> ? A : never;
type SchemaEncoded<S> = S extends Schema.Schema<any, infer I, any> ? I : never;
export type ParamEntry<S extends Schema.Schema<any, any>> = {
    readonly schema: S;
    readonly decode: (raw: unknown) => Effect.Effect<SchemaType<S>, ParseResult.ParseError, never>;
    readonly encode: (value: SchemaType<S>) => Effect.Effect<SchemaEncoded<S>, ParseResult.ParseError, never>;
    readonly formatted: (value: SchemaType<S>) => string;
    readonly decodeSync: (raw: unknown) => SchemaType<S>;
    readonly encodeSync: (value: SchemaType<S>) => SchemaEncoded<S>;
};
export type ParamEntryOfConfig<C extends ParamConfig> = C extends ScaledParamConfig<infer A> ? ParamEntry<Schema.Schema<A, number>> : C extends SignedScaledParamConfig<infer A> ? ParamEntry<Schema.Schema<A, number>> : C extends EnumParamConfig<infer Domain> ? ParamEntry<Schema.Schema<Domain, number>> : C extends BitfieldParamConfig<infer F> ? BitfieldParamEntry<F> : C extends LookupParamConfig<infer Domain> ? ParamEntry<Schema.Schema<Domain, number>> : ParamEntry<Schema.Schema<number, number>>;
export type ParamValueOfEntry<E extends ParamEntry<any>> = E extends ParamEntry<Schema.Schema<infer A, any>> ? A : never;
/**
 * Simple UInt16 pass-through parameter.
 * The wire value IS the parameter value (no scaling).
 */
export declare const makeParam: <A extends number, I extends number>(register: number, meta: RegisterMeta) => ParamEntry<Schema.Schema<A, I>>;
/**
 * Scaled parameter where wire = domain / factor.
 * Decode validates through the optional branded `domain` schema so out-of-range
 * wire values fail (strict). Set `readOnly` to make encode fail with
 * {@link readOnlyEncodeFailure} (monitor registers).
 */
export declare const makeScaledParam: <A = number>(register: number, factor: number, meta: RegisterMeta, opts?: {
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
}) => ParamEntry<Schema.Schema<A, number>>;
/**
 * Signed scaled parameter where wire = domain / factor, using UInt16 as the
 * wire-side schema with two's-complement conversion (Modbus delivers unsigned
 * 16-bit values). Decode validates through the optional branded `domain`.
 */
export declare const makeSignedScaledParam: <A = number>(register: number, factor: number, meta: RegisterMeta, opts?: {
    readonly domain?: Schema.Schema<A, any, any>;
    readonly readOnly?: boolean;
}) => ParamEntry<Schema.Schema<A, number>>;
/**
 * Enum selection parameter.
 * Maps wire integers to human-readable labels and back.
 */
export declare const makeEnumParam: <Domain extends string>(register: number, labels: Record<number, Domain>, meta: RegisterMeta, opts?: {
    readonly readOnly?: boolean;
}) => ParamEntry<Schema.Schema<Domain, number>>;
/**
 * Minimal structural shape the bitfield factory needs from a
 * {@link Schema.Class}-derived class: it is both a schema (so it can serve as
 * the `to` of a `transformOrFail`) and an instantiable class.
 */
export type AnyBitfieldClass = new (fields: any) => any;
/**
 * Constructor shape produced for the generated patch class. Allows `new`
 * construction with a partial record of booleans.
 */
export type AnyPatchClass = new (props?: Partial<{
    readonly [k: string]: boolean;
}>) => any;
/**
 * A bitfield entry adds a generated `patch` schema (all-optional booleans) and
 * a `merge` function for read-modify-write semantics.
 */
export type BitfieldParamEntry<F extends AnyBitfieldClass> = ParamEntry<Schema.Schema<InstanceType<F>, number>> & {
    readonly patch: AnyPatchClass;
    readonly merge: (base: InstanceType<F>, patch: Readonly<Record<string, boolean | undefined>>) => InstanceType<F>;
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
export declare const makeBitfieldParam: <F extends AnyBitfieldClass>(register: number, flagsClass: F, bitLayout: Record<keyof InstanceType<F>, number>, meta: RegisterMeta, opts?: {
    readonly readOnly?: boolean;
}) => BitfieldParamEntry<F>;
/**
 * Lookup parameter: maps a wire integer → branded `Domain` string via a fixed
 * `labels` table, routing unknown codes through a `fallback`. Inherently
 * decode-only (encode always fails with {@link readOnlyEncodeFailure}); use for
 * monitor registers that report fault/alarm/model codes as human-readable text.
 */
export declare const makeLookupParam: <Domain extends string>(register: number, labels: Record<number, Domain>, fallback: (raw: number) => Domain, meta: RegisterMeta, opts?: {
    readonly domain?: Schema.Schema<Domain, any, any>;
}) => ParamEntry<Schema.Schema<Domain, number>>;
export declare function fromConfig<C extends ParamConfig>(config: C): ParamEntryOfConfig<C>;
export {};
