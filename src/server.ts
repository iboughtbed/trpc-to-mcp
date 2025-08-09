import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Implementation,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  AnyProcedure,
  AnyRootTypes,
  DecorateRouterRecord,
  MaybePromise,
  Router,
  RouterRecord,
} from "@trpc/server/unstable-core-do-not-import";

import { extractToolsFromProcedures, type McpTool } from "./tools";
import type { McpMeta } from "./types";

export function setRequestHandler<TRecord extends RouterRecord>(
  server: Server,
  tools: McpTool[],
  trpcCaller: DecorateRouterRecord<TRecord>,
) {
  // List all of the available tools
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return { content: [{ type: "text", text: "Could not find tool" }] };
    }

    // @ts-expect-error path in router
    const procedure: AnyProcedure = tool.pathInRouter.reduce(
      // @ts-expect-error path in router
      (acc, part) => acc?.[part],
      trpcCaller,
    );

    const meta = procedure.meta as McpMeta | undefined;
    const transformMcpProcedure = meta?.mcp?.transformMcpProcedure;

    if (typeof transformMcpProcedure === "function") {
      // @ts-expect-error path in router
      const result = await transformMcpProcedure(procedure(args));

      return {
        content: result,
      };
    } else {
      // @ts-expect-error path in router
      const result = await procedure(args);

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  });
}

export function createMcpServer<
  TRoot extends AnyRootTypes,
  TRecord extends RouterRecord,
>(
  implementation: Implementation,
  appRouter: Router<TRoot, TRecord>,
  ctx: TRoot["ctx"] | (() => MaybePromise<TRoot["ctx"]>),
) {
  const tools = extractToolsFromProcedures(appRouter);
  const trpcCaller = appRouter.createCaller(ctx);

  const server = new McpServer(implementation, {
    capabilities: {
      // Leave it empty because we list tools manually
      tools: {},
    },
  });

  setRequestHandler(server.server, tools, trpcCaller);

  return server;
}
