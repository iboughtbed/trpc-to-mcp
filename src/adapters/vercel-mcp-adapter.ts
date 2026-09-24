import type { McpServer } from "@modelcontextprotocol/server";
import type { AnyTRPCRouter } from "@trpc/server";
import { createMcpHandler, type McpHandlerOptions } from "mcp-handler";

import { registerTrpcTools } from "../tools";
import type { MaybePromise, McpContext } from "../types";

export type { McpHandlerOptions };

/**
 * Creates an `mcp-handler` request handler, a `(Request) => Promise<Response>`
 * you can mount as a Next.js route or in any Fetch-compatible framework.
 * Use `callback` to register extra tools, prompts, or resources.
 */
export function trpcToMcpHandler<TRouter extends AnyTRPCRouter>(
  router: TRouter,
  ctx: McpContext<TRouter>,
  options: {
    serverOptions?: McpHandlerOptions;
    callback?: (server: McpServer) => MaybePromise<void>;
  } = {},
) {
  return createMcpHandler(async (server) => {
    registerTrpcTools(server, router, ctx);
    await options.callback?.(server);
  }, options.serverOptions);
}
