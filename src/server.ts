import {
  McpServer,
  type Implementation,
  type ServerOptions,
} from "@modelcontextprotocol/server";
import type { AnyTRPCRouter } from "@trpc/server";

import { registerTrpcTools } from "./tools";
import type { McpContext } from "./types";

/**
 * Creates an `McpServer` with the router's MCP-enabled procedures registered
 * as tools. Connect it to a transport yourself, or return it from the
 * factory you pass to the SDK's `createMcpHandler`.
 */
export function createMcpServer<TRouter extends AnyTRPCRouter>(
  implementation: Implementation,
  router: TRouter,
  ctx: McpContext<TRouter>,
  options?: ServerOptions,
) {
  const server = new McpServer(implementation, options);
  registerTrpcTools(server, router, ctx);
  return server;
}
