---
"trpc-to-mcp": major
---

Support MCP TypeScript SDK v2, mcp-handler v2, and tRPC 11.19.

Breaking changes:

- The peer dependency is now `@modelcontextprotocol/server` ^2.0.0. Remove `@modelcontextprotocol/sdk`, and upgrade `mcp-handler` to ^2.0.0 if you use the adapter. Node.js 20 or later is required.
- `trpcToMcpHandler` no longer takes `config`. mcp-handler v2 removed those options, so mount the handler at the route you want and pass `verboseLogs`, `serverInfo`, and other handler options in `serverOptions`.
- Input schemas now come from Standard JSON Schema instead of `z.toJSONSchema`. Zod 4.2 or later, ArkType, and Valibot with `toStandardJsonSchema` all work. zod is no longer a peer dependency.
- An enabled procedure whose input is not an object schema, or that is a subscription, now throws at startup instead of logging an error.
- `setRequestHandler` and `mergeInputs` are removed. Use `registerTrpcTools(server, router, ctx)` to add tools to an existing `McpServer`.
- In `McpTool`, `pathInRouter: string[]` is now `path: string`, which holds the dotted procedure path, and `transformMcpProcedure` is now `transform`. `meta.mcp.transformMcpProcedure` is removed; use the `transformMcpProcedure()` helper.

New:

- Tools are registered with `McpServer.registerTool`, so you can register your own tools, prompts, and resources on the same server. Before, the adapter's `callback` threw if you called `registerTool`.
- The context argument can be a function of the MCP request context. It runs on every tool call and can read `ctx.http?.authInfo` and `ctx.http?.req`.
- Procedures with an `.output()` object schema advertise an `outputSchema` and return `structuredContent`.
- Queries get the `readOnlyHint: true` annotation. Set `title` and `annotations` in `meta.mcp`.
- Tool calls pass the MCP request's abort signal to tRPC.
- tRPC errors come back as tool results with `isError: true`.

Fixes:

- `transformMcpProcedure` no longer applies a transform to other procedures built from the same base procedure.
