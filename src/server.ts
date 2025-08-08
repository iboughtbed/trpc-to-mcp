import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type Implementation,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  AnyProcedure,
  AnyRootTypes,
  Router,
  RouterRecord,
} from "@trpc/server/unstable-core-do-not-import";

import { extractToolsFromProcedures } from "./tools";

type MaybePromise<T> = Promise<T> | T;

export function createMcpServer<
  TRoot extends AnyRootTypes,
  TRecord extends RouterRecord
>(
  implementation: Implementation,
  appRouter: Router<TRoot, TRecord>,
  ctx: TRoot["ctx"] | (() => MaybePromise<TRoot["ctx"]>)
) {
  const tools = extractToolsFromProcedures(appRouter);
  const trpcCaller = appRouter.createCaller(ctx);

  const server = new Server(implementation, {
    capabilities: {
      // Leave it empty because we list tools manually
      tools: {},
    },
  });

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
      trpcCaller
    );

    // @ts-expect-error path in router
    const result = await procedure(args);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  });
}
