/**
 * # modbus-schema
 *
 * Device-agnostic Effect Schema generators for Modbus register values.
 *
 * Provides factory functions that produce bidirectional schemas between
 * 16-bit wire values (`UInt16` / `Int16`) and domain types, with both
 * Effect-native (`decode` / `encode`) and synchronous (`decodeSync` /
 * `encodeSync`) APIs so the Effect runtime is optional for consumers.
 *
 * @module
 */
export * from "./src/index.js";
