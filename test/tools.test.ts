import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { TRPCError, initTRPC } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createMcpServer,
  extractToolsFromProcedures,
  transformMcpProcedure,
  type McpContext,
  type McpMeta,
} from "../src";
import { trpcToMcpHandler } from "../src/adapters/vercel-mcp-adapter";

const t = initTRPC
  .context<{ userId: string | null }>()
  .meta<McpMeta>()
  .create();

// Procedures built from this share one `meta.mcp` object.
const mcpProcedure = t.procedure.meta({ mcp: { enabled: true } });

const appRouter = t.router({
  greet: t.procedure
    .meta({ mcp: { enabled: true, name: "say_hello", description: "Greet" } })
    .input(z.object({ name: z.string() }))
    .query(({ input, ctx }) => `Hello ${input.name} from ${ctx.userId}`),
  user: t.router({
    rename: t.procedure
      .meta({ mcp: { enabled: true } })
      .input(z.object({ id: z.string() }))
      .input(z.object({ name: z.string().optional() }))
      .output(z.object({ id: z.string(), name: z.string() }))
      .mutation(({ input }) => ({ id: input.id, name: input.name ?? "anon" })),
  }),
  length: mcpProcedure
    .input(z.object({ text: z.string().transform((s) => s.length) }))
    .query(({ input }) => ({ length: input.text })),
  shout: transformMcpProcedure(
    mcpProcedure.query(() => "hi"),
    (output) => [{ type: "text", text: output.toUpperCase() }],
  ),
  whisper: mcpProcedure.query(() => "HI"),
  fail: mcpProcedure.mutation(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nope" });
  }),
  hidden: t.procedure.query(() => "not a tool"),
});

async function connect(ctx: McpContext<typeof appRouter>) {
  const server = createMcpServer(
    { name: "test", version: "1.0.0" },
    appRouter,
    ctx,
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("extractToolsFromProcedures", () => {
  it("lists only MCP-enabled procedures, with names and merged inputs", () => {
    const tools = extractToolsFromProcedures(appRouter);

    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      "fail",
      "length",
      "say_hello",
      "shout",
      "user_rename",
      "whisper",
    ]);

    const rename = tools.find((tool) => tool.name === "user_rename");
    expect(rename?.inputSchema).toEqual({
      type: "object",
      properties: { id: { type: "string" }, name: { type: "string" } },
      required: ["id"],
    });
    expect(rename?.outputSchema).toMatchObject({ type: "object" });
    expect(rename?.annotations).toBeUndefined();

    const greet = tools.find((tool) => tool.name === "say_hello");
    expect(greet?.annotations).toEqual({ readOnlyHint: true });
  });

  it("rejects subscriptions and non-object inputs", () => {
    const subscription = t.router({
      events: mcpProcedure.subscription(async function* () {}),
    });
    const stringInput = t.router({
      echo: mcpProcedure.input(z.string()).query(({ input }) => input),
    });

    expect(() => extractToolsFromProcedures(subscription)).toThrow(
      /subscription/,
    );
    expect(() => extractToolsFromProcedures(stringInput)).toThrow(
      /object schema/,
    );
  });
});

describe("createMcpServer", () => {
  it("calls procedures with the context from the factory", async () => {
    const client = await connect(() => ({ userId: "u1" }));

    const result = await client.callTool({
      name: "say_hello",
      arguments: { name: "Ada" },
    });

    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify("Hello Ada from u1") },
    ]);
  });

  it("returns structured content for procedures with an output schema", async () => {
    const client = await connect({ userId: null });

    const result = await client.callTool({
      name: "user_rename",
      arguments: { id: "1", name: "Ada" },
    });

    expect(result.structuredContent).toEqual({ id: "1", name: "Ada" });
  });

  it("lets tRPC validate input, applying transforms once", async () => {
    const client = await connect({ userId: null });

    const ok = await client.callTool({
      name: "length",
      arguments: { text: "abc" },
    });
    const invalid = await client.callTool({
      name: "length",
      arguments: { text: 1 },
    });

    expect(ok.content).toEqual([{ type: "text", text: '{"length":3}' }]);
    expect(invalid.isError).toBe(true);
  });

  it("applies a transform only to the procedure it wraps", async () => {
    const client = await connect({ userId: null });

    const shout = await client.callTool({ name: "shout", arguments: {} });
    const whisper = await client.callTool({ name: "whisper", arguments: {} });

    expect(shout.content).toEqual([{ type: "text", text: "HI" }]);
    expect(whisper.content).toEqual([{ type: "text", text: '"HI"' }]);
  });

  it("returns tRPC errors as tool errors", async () => {
    const client = await connect({ userId: null });

    const result = await client.callTool({ name: "fail", arguments: {} });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "Nope" }],
    });
  });
});

describe("trpcToMcpHandler", () => {
  it("serves tools over HTTP next to tools from the callback", async () => {
    const handler = trpcToMcpHandler(appRouter, () => ({ userId: "u2" }), {
      callback: (server) => {
        server.registerTool("ping", {}, () => ({
          content: [{ type: "text", text: "pong" }],
        }));
      },
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
        fetch: (url, init) => handler(new Request(url, init)),
      }),
    );

    const { tools } = await client.listTools();
    const greeting = await client.callTool({
      name: "say_hello",
      arguments: { name: "Ada" },
    });

    expect(tools.map((tool) => tool.name)).toContain("ping");
    expect(greeting.content).toEqual([
      { type: "text", text: JSON.stringify("Hello Ada from u2") },
    ]);
  });
});
