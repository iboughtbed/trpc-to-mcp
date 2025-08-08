import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type {
  AnyRootTypes,
  MaybePromise,
  Router,
  RouterRecord,
} from "@trpc/server/unstable-core-do-not-import";
import { createMcpHandler } from "mcp-handler";

import { setRequestHandler } from "../server";
import { extractToolsFromProcedures } from "../tools";

export type VercelMcpHandler = ReturnType<typeof createMcpHandler>;
export type McpServerOptions = Parameters<typeof createMcpHandler>[1];
export type McpHandlerConfig = Parameters<typeof createMcpHandler>[2];

export function trpcToMcpHandler<
  TRoot extends AnyRootTypes,
  TRecord extends RouterRecord,
>(
  appRouter: Router<TRoot, TRecord>,
  ctx: TRoot["ctx"] | (() => MaybePromise<TRoot["ctx"]>),
  handlerOptions: {
    config: McpHandlerConfig;
    serverOptions?: McpServerOptions;
    callback?: (server: McpServer) => unknown;
  },
) {
  const { serverOptions, config, callback } = handlerOptions;

  const tools = extractToolsFromProcedures(appRouter);
  const trpcCaller = appRouter.createCaller(ctx);

  const handler = createMcpHandler(
    (server) => {
      setRequestHandler(server.server, tools, trpcCaller);

      if (typeof callback === "function") {
        callback(server);
      }
    },
    {
      // Leave it empty because we list tools manually
      capabilities: {
        tools: {},
      },
      ...serverOptions,
    },
    config,
  );

  return handler;
}
