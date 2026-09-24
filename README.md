# trpc-to-mcp

Turn the tRPC procedures you choose into MCP tools.

- Works with tRPC v11 and `@modelcontextprotocol/server` v2, the MCP TypeScript SDK
- [Serve tools over stdio or HTTP](#serve-your-tools)
- [Use the tRPC context and middlewares on every tool call](#context)
- [Transform outputs into text, images, or other MCP content](#transform-outputs)
- [Return structured content from procedures with an output schema](#structured-output)
- [Mount on Next.js and other frameworks with mcp-handler](#mcp-handler)

<details>
<summary>Why only the procedures you choose?</summary>

An MCP tool is something a language model decides to call on its own, so expose only the procedures you want a model to use. A model picks a tool based on its name, description, and input schema. Give each exposed procedure a clear name, a description of what it does and when to use it, and a `.describe()` on each input field.

</details>

## Install

```bash
pnpm add trpc-to-mcp @modelcontextprotocol/server
```

`@trpc/server` 11 and `@modelcontextprotocol/server` 2 are peer dependencies. Node.js 20 or later is required.

## Usage

1. Add `McpMeta` to your tRPC instance.

```typescript
import { initTRPC } from "@trpc/server";
import { type McpMeta } from "trpc-to-mcp";

const t = initTRPC.context<Context>().meta<McpMeta>().create();
```

2. Enable `mcp` on the procedures you want as tools.

```typescript
import { z } from "zod";

export const appRouter = t.router({
  hello: t.procedure
    .meta({
      mcp: {
        enabled: true,
        description: "Say hello to someone",
        // Optional. Defaults to the procedure path with dots replaced by
        // underscores, e.g. "hello" or "user_byId".
        name: "say_hello",
      },
    })
    .input(z.object({ name: z.string().describe("Who to greet") }))
    .query(({ input }) => `Hello ${input.name}`),
});
```

Inputs must be object schemas from a validator that implements [Standard JSON Schema](https://standardschema.dev), such as zod 4.2 or later, ArkType, or Valibot with `toStandardJsonSchema()`. Chained `.input()` calls are merged into one tool input schema. Subscriptions can't be tools.

tRPC validates input on every call, so your zod transforms and refinements run as usual. Errors thrown by a procedure, including `TRPCError`, come back to the client as a tool result with `isError: true`.

`meta.mcp` also takes `title` and `annotations`. Queries get `readOnlyHint: true` unless you set it yourself.

## Serve your tools

`createMcpServer` returns an `McpServer` with your tools registered. You can register more tools, prompts, and resources on it.

Over stdio:

```typescript
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createMcpServer } from "trpc-to-mcp";

serveStdio(() =>
  createMcpServer({ name: "my-app", version: "1.0.0" }, appRouter, { db }),
);
```

Over HTTP, with the SDK's `createMcpHandler` on any runtime with web-standard `Request` and `Response`:

```typescript
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpServer } from "trpc-to-mcp";

const handler = createMcpHandler(() =>
  createMcpServer({ name: "my-app", version: "1.0.0" }, appRouter, { db }),
);

export default { fetch: handler.fetch };
```

To add tools to an `McpServer` you created yourself, call `registerTrpcTools(server, appRouter, ctx)`.

## Context

The third argument is the tRPC context. Pass a value, or a function that creates the context on each tool call. The function receives the MCP request context, so it can read the HTTP request and the auth info from your auth middleware.

```typescript
createMcpServer({ name: "my-app", version: "1.0.0" }, appRouter, (ctx) => ({
  db,
  headers: ctx.http?.req?.headers,
  auth: ctx.http?.authInfo,
}));
```

Tool calls run through your tRPC middlewares, so auth checks in a `protectedProcedure` apply to MCP clients too.

## Transform outputs

By default a tool returns the procedure output as JSON text. To return something easier for a model to read, wrap the procedure with `transformMcpProcedure` and return MCP content blocks. The `output` argument is typed from the procedure.

```typescript
import { transformMcpProcedure } from "trpc-to-mcp";

export const appRouter = t.router({
  weather: transformMcpProcedure(
    t.procedure
      .meta({
        mcp: { enabled: true, description: "Current weather in a city" },
      })
      .input(z.object({ city: z.string() }))
      .query(({ input }) => getWeather(input.city)),
    (output) => [
      { type: "text", text: `${output.city}: ${output.temperature}°C` },
      { type: "image", data: output.radarPng, mimeType: "image/png" },
    ],
  ),
});
```

The content types are `text`, `image`, `audio`, `resource`, and `resource_link`. The procedure still returns its normal output to tRPC clients.

## Structured output

If a procedure has an `.output()` validator that describes an object, the tool advertises it as an `outputSchema` and returns the output as `structuredContent` next to the text content.

```typescript
t.procedure
  .meta({ mcp: { enabled: true, description: "Look up a user" } })
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string(), name: z.string() }))
  .query(({ input }) => db.user.find(input.id));
```

## mcp-handler

[mcp-handler](https://github.com/vercel/mcp-handler) turns an MCP server into a `(Request) => Promise<Response>` handler for Next.js, Nuxt, SvelteKit, Hono, and other frameworks. Install `mcp-handler` 2, then:

```typescript
// app/api/mcp/route.ts
import { trpcToMcpHandler } from "trpc-to-mcp/adapters/vercel-mcp-adapter";

const handler = trpcToMcpHandler(appRouter, createContext, {
  // mcp-handler options
  serverOptions: {
    serverInfo: { name: "my-app", version: "1.0.0" },
    verboseLogs: process.env.NODE_ENV === "development",
  },
  // Register extra tools, prompts, or resources
  callback: (server) => {},
});

export { handler as GET, handler as POST };
```

mcp-handler serves requests without sessions, so there is no Redis setup and no `basePath`. Mount the handler at any route.

## Use with better-auth

The [`@better-auth/mcp`](https://www.better-auth.com/docs/plugins/mcp) plugin makes your better-auth app an OAuth authorization server for MCP clients. Put your handler behind `requireMcpAuth`, and read the user ID from the access token claims.

```typescript
// app/api/mcp/route.ts
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpServer } from "trpc-to-mcp";

export const POST = requireMcpAuth(auth, (request, claims) => {
  const handler = createMcpHandler(
    () =>
      createMcpServer({ name: "my-app", version: "1.0.0" }, appRouter, {
        db,
        userId: claims.sub,
      }),
    // @better-auth/mcp recommends serving only the 2026-07-28 protocol.
    { legacy: "reject" },
  );

  return handler.fetch(request);
});
```

## List tools without a server

`extractToolsFromProcedures` returns the tool definitions, including JSON input schemas, without creating a server.

```typescript
import { extractToolsFromProcedures } from "trpc-to-mcp";

const tools = extractToolsFromProcedures(appRouter);
// [{ name: "say_hello", description: "...", path: "hello", type: "query", inputSchema: {...} }]
```

## Upgrading from 1.x

- Replace `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server` 2, and upgrade `mcp-handler` to 2 if you use the adapter.
- In `trpcToMcpHandler`, remove `config`. Move `verboseLogs` into `serverOptions`, and mount the handler at the route you want.
- Use zod 4.2 or later, or another validator with Standard JSON Schema support.
- Replace `setRequestHandler(server.server, tools, caller)` with `registerTrpcTools(server, appRouter, ctx)`.
- `McpTool.pathInRouter` is now `McpTool.path`, a dotted string.

See [CHANGELOG.md](./CHANGELOG.md) for the full list.

## Result

Now you can chill and add MCP to your VC-backed startup so your investors won't worry, and profit

## Twitter / X

https://x.com/iboughtbed - cracked 17 year old engineer from Kazakhstan :)
