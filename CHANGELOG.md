# trpc-to-mcp

## 2.0.0

### Major Changes

- 01f3034: Support MCP TypeScript SDK v2, mcp-handler v2, and tRPC 11.19.

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

## 1.3.2

### Patch Changes

- 2081ba3: fix: transformer function being undefined and not receiving output

## 1.3.1

### Patch Changes

- 639b37e: fix: incorrect path for mcp meta callback

## 1.3.0

### Minor Changes

- 2a6a592: feat: create a helper to transform procedure outputs to human language

## 1.2.0

### Minor Changes

- 2edd505: return high-level McpServer instead of low-level Server in createMcpServer

## 1.1.5

### Patch Changes

- 9da2b1a: fix: export mcp meta type

## 1.1.4

### Patch Changes

- cc4b23c: fix: misspelled filename

## 1.1.3

### Patch Changes

- 55bf8ec: fix: include dist in package.json files

## 1.1.2

### Patch Changes

- e8f84b7: fix tsup not building dist

## 1.1.1

### Patch Changes

- 7629f0d: Fix tsup.config.ts and dist output

## 1.1.0

### Minor Changes

- a9f1c69: Implement @vercel/mcp-handler adapter for trpc-to-mcp

## 1.0.0

### Major Changes

- 7341e0f: Release package
