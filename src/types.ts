import type {
  ContentBlock,
  ServerContext,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import type { AnyTRPCRouter, inferRouterContext } from "@trpc/server";

export type MaybePromise<T> = T | Promise<T>;

/**
 * Procedure meta read by trpc-to-mcp. Pass it to `initTRPC.meta<McpMeta>()`
 * and set `mcp.enabled` on each procedure you want to expose as a tool.
 */
export type McpMeta = {
  mcp?: {
    enabled?: boolean;
    /** Tool name. Defaults to the procedure path with dots replaced by underscores. */
    name?: string;
    /** Human-readable name shown by MCP clients. */
    title?: string;
    description?: string;
    /** Hints for MCP clients. Queries get `readOnlyHint: true` unless you override it. */
    annotations?: ToolAnnotations;
  };
};

/** Turns a procedure's output into MCP content. Set with `transformMcpProcedure`. */
export type McpToolTransform = (
  output: unknown,
) => MaybePromise<ContentBlock[]>;

/**
 * Creates the tRPC context for a tool call. It receives the MCP request
 * context, so it can read `ctx.http?.authInfo` and `ctx.http?.req`.
 */
export type McpContextFactory<TRouter extends AnyTRPCRouter> = (
  ctx: ServerContext,
) => MaybePromise<inferRouterContext<TRouter>>;

/** The tRPC context for tool calls: a fixed value or a per-call factory. */
export type McpContext<TRouter extends AnyTRPCRouter> =
  | inferRouterContext<TRouter>
  | McpContextFactory<TRouter>;
