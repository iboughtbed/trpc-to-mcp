import type { ContentBlock } from "@modelcontextprotocol/server";
import type { AnyTRPCProcedure, inferProcedureOutput } from "@trpc/server";

import type { MaybePromise, McpToolTransform } from "./types";

// Keyed by procedure instead of stored in meta: procedures built from the same
// base procedure share one `meta.mcp` object, so writing to it would leak the
// transform into sibling procedures.
const transforms = new WeakMap<AnyTRPCProcedure, McpToolTransform>();

/**
 * Wraps a procedure so its MCP tool returns `transform(output)` as content
 * instead of the JSON-serialized output. The procedure itself is unchanged.
 */
export function transformMcpProcedure<TProcedure extends AnyTRPCProcedure>(
  procedure: TProcedure,
  transform: (
    output: inferProcedureOutput<TProcedure>,
  ) => MaybePromise<ContentBlock[]>,
): TProcedure {
  // The map only hands this transform the output of `procedure`.
  transforms.set(procedure, transform as McpToolTransform);
  return procedure;
}

/** @internal Used by `extractToolsFromProcedures`. */
export function getMcpTransform(procedure: AnyTRPCProcedure) {
  return transforms.get(procedure);
}
