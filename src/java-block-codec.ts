/** Resolves Blockbench's built-in Java block/item compiler without owning another format. */

export interface JavaBlockCodec {
  compile(options?: { prevent_dialog?: boolean }): string;
}

function isCompilingCodec(value: unknown): value is JavaBlockCodec {
  return Boolean(
    value && typeof (value as { compile?: unknown }).compile === "function"
  );
}

/**
 * Some third-party formats remove `Codecs.java_block` from the registry when they unload, while
 * Blockbench's built-in Java format still retains the live codec instance. Prefer the current
 * format when it exposes a compiler, then fall back to the built-in Java format and registry.
 */
export function resolveJavaBlockCodec(): JavaBlockCodec {
  const candidates: unknown[] = [
    typeof Format !== "undefined" ? Format?.codec : undefined,
    typeof Formats !== "undefined" ? Formats.java_block?.codec : undefined,
    typeof Codecs !== "undefined" ? Codecs.java_block : undefined,
  ];

  const codec = candidates.find(isCompilingCodec);
  if (!codec) {
    throw new Error(
      "Blockbench's Java block/item model compiler is unavailable. Reload Blockbench and try again."
    );
  }
  return codec;
}
