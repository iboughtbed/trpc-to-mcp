import { ContentBlock } from "@modelcontextprotocol/sdk/types";
import type {
  AnyProcedure,
  MaybePromise,
  inferProcedureOutput,
} from "@trpc/server/unstable-core-do-not-import";

export function transformMcpProcedure<TProcedure extends AnyProcedure>(
  procedure: TProcedure,
  callback: (
    output: inferProcedureOutput<TProcedure>,
  ) => MaybePromise<ContentBlock[]>,
) {
  if (procedure.meta?.mcp?.enabled) {
    procedure.meta.mcp.transformMcpProcedure = callback;
  }

  return procedure;
}
