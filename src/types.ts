import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import type {
  AnyProcedure,
  MaybePromise,
  inferProcedureOutput,
} from "@trpc/server/unstable-core-do-not-import";

export type McpMeta = {
  mcp?: {
    enabled?: boolean;
    description?: string;
    name?: string;
    transformMcpProcedure?: TransformMcpProcedureFunction;
  };
};

export type TransformMcpProcedureFunction = (
  output: inferProcedureOutput<AnyProcedure>,
) => MaybePromise<ContentBlock[]>;
