## Introduction

You can skip this part if you know exactly why you're turning your tRPC endpoints into MCP tools.

<details>
<summary>How to think of MCPs</summary>

At its core, the Model Context Protocol (MCP) gives language models a context to interact with external systems by exposing well-defined tools. This isn't about wrapping API endpoints- it's about enabling AI to perform tasks with clarity and purpose.

This library was created to convert only the tRPC procedures you explicitly choose into MCP tools. By doing so, it ensures that only the functionalities intended for controlled AI interaction are exposed, rather than indiscriminately converting all endpoints.

Remember, for an endpoint to be effectively transformed into an MCP tool, it should be meticulously documented with clear descriptions, meaningful names, and well-defined inputs/outputs. This careful design is crucial because MCP tools are more than mere API endpoints - they form the operational contexts that enable language models to function reliably.

</details>

## tRPC to MCP

- Support for tRPC v11
- [Transform your JSON outputs into human-language with custom helpers](#transform-outputs)
- [Turn your tRPC router into MCP tools](#to-mcp-tools)
- [Turn your tRPC router into MCP server](#to-mcp-server)
- [Turn your tRPC router into @vercel/mcp-adapter handler](#to-vercel-mcp-adapter)

## Usage

1. Install trpc-to-mcp

```bash
npm install trpc-to-mcp

pnpm add trpc-to-mcp

bun add trpc-to-mcp

yarn add trpc-to-mcp
```

2. Add `McpMeta` to your tRPC instance

```typescript
import { initTRPC } from "@trpc/server";
import { type McpMeta } from "trpc-to-mcp";

const t = initTRPC.meta<McpMeta>().create();
```

3. Enable `mcp` support for a procedure

```typescript
export const appRouter = t.router({
  hello: t.procedure
    .meta({
      mcp: {
        enabled: true,
        description: "Say hello to a name",
        // You can leave it empty, it'll be converted to "hello"
        // If you have subrouters, then subrouter_procedure_name
        name: "say_hello",
      },
    })
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}` };
    }),
});
```

## Transform Outputs

If you need a human-language outputs for LLMs to have a better context, you can use `transformMcpProcedure`

You simply wrap your procedure with the helper function, and provide a transformer callback function that turns your procedure output into `ContentBlock[]` array compatible with MCP content output.

```typescript
import { initTRPC } from "@trpc/server";
import { z } from "zod";

import { transformMcpProcedure, type McpMeta } from "../src";

const t = initTRPC.meta<McpMeta>().create();

export const appRouter = t.router({
  procedure: transformMcpProcedure(
    t.procedure
      .meta({
        mcp: {
          enabled: true,
          description: "Send a message",
          name: "send_message",
        },
      })
      .input(
        z.object({
          message: z.string(),
        }),
      )
      .query(({ input }) => {
        return {
          payload: {
            from: "trpc",
            message: input.message,
            array: [{ a: 1 }, { b: 2 }],
          },
        };
      }),
    (output) => {
      return [
        ...output.payload.array.map((item) => {
          const [name, value] = Object.entries(item);
          return {
            type: "text" as const,
            text: `${name} is ${value} letter of alphabet`,
          };
        }),
        {
          type: "image",
          data: "...",
          mimeType: "",
        },
        {
          type: "audio", // or even "resource" | "resource_link"
          data: "...",
          mimeType: "",
        },
      ];
    },
  ),
});
```

## To MCP tools

4. You can turn a router into tools

```typescript
import { appRouter } from "@/server/trpc/root.ts";
import { extractToolsFromProcedures } from "trpc-to-mcp";

const tools = extractToolsFromProcedures(appRouter);

/*

[
  {
    name: "Tool name",
    description: "Description of the tool",
    pathInRouter: [...],
    inputSchema: JSONSchema // this if full JSON schema from your zod schema
  },
  ...
]

*/
```

## To MCP server

5. You can turn a router into an MCP server

```typescript
import { appRouter } from "@/server/trpc/root.ts";
import { createMcpServer } from "trpc-to-mcp";

const ctx = {
  session: {
    // ...
  },
};

// Returns high-level McpServer instance
const mcpServer = createMcpServer(
  implementation, // Pass your Implementation instance
  appRouter,
  ctx, // Pass your tRPC context
);
```

## To Vercel MCP adapter

6. You can turn a router into `@vercel/mcp-adapter` handler

```typescript
// app/api/[transport]/route.ts
import { trpcToMcpHandler } from "trpc-to-mcp/adapters/vercel-mcp-adapter";

const handler = trpcToHandler(appRouter, ctx, {
  // @vercel/mcp-adapter config options
  config: {
    basePath: "/api",
    // Disable in production
    verboseLogs: true,
    maxDuration: 60,
  },
  // @vercel/mcp-adapter server options
  serverOptions: { ... },
  callback: (server) => {
    // You can modify the McpServer instance
  }
});

export { handler as DELETE, handler as GET, handler as POST };
```

## Use with better-auth

7. You can use it with better-auth

```typescript
// app/api/[transport]/route.ts

import { withMcpAuth } from "better-auth/plugins";
import { trpcToMcpHandler } from "trpc-to-mcp/adapters/vercel-mcp-adapter";

// Define a function to retrieve user session from database
async function getSession(mcpSession: McpSession): Promise<Session | null> {
  // You can use mcpSession.userId to fetch session
  // await db.query.session.findFirst({
  //    where: (table, { eq }) => eq(table.userId, mcpSession.userId)
  // })
}

const handler = withMcpAuth(auth, async (request, mcpSession) => {
  // Retrieve the session from database via userId inside mcpSession
  const session = await getSession(mcpSession);

  const handler = trpcToMcpHandler(
    appRouter,
    // Pass your tRPC context here
    {
      db,
      headers: request.headers,
      session: session?.session,
      user: session?.user,
    },
    {
      config: {
        basePath: "/api",
        // Disable in production
        verboseLogs: true,
        maxDuration: 60,
      },
    },
  );

  return await handler(request);
});

export { handler as DELETE, handler as GET, handler as POST };
```

## Result

Now you can chill and add MCP to your VC-backed startup so your investors won't worry, and profit

## Twitter / X

https://x.com/iboughtbed - cracked 17 year old engineer from Kazakhstan :)
