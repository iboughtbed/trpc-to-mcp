import type {
  CallToolResult,
  McpServer,
  ServerContext,
  StandardSchemaWithJSON,
  Tool,
} from "@modelcontextprotocol/server";
import {
  callTRPCProcedure,
  type AnyTRPCProcedure,
  type AnyTRPCRouter,
} from "@trpc/server";

import { getMcpTransform } from "./helpers";
import type {
  McpContext,
  McpContextFactory,
  McpMeta,
  McpToolTransform,
} from "./types";

/** An MCP tool definition built from a tRPC procedure. */
export type McpTool = Pick<
  Tool,
  "name" | "title" | "description" | "annotations" | "inputSchema"
> & {
  /** Dotted procedure path, e.g. `user.byId`. */
  path: string;
  type: "query" | "mutation";
  /** Set when the procedure has an `.output()` validator that describes an object. */
  outputSchema?: Tool["outputSchema"];
  transform?: McpToolTransform;
};

type JsonSchema = Record<string, unknown>;

// Target and options passed to the Standard JSON Schema converters.
// `unrepresentable: "any"` keeps zod from throwing on types like `z.date()`.
const JSON_SCHEMA_OPTIONS = {
  target: "draft-2020-12",
  libraryOptions: { unrepresentable: "any" },
} as const;

function hasJsonSchema(parser: unknown): parser is StandardSchemaWithJSON {
  if (typeof parser !== "object" && typeof parser !== "function") return false;
  if (parser === null || !("~standard" in parser)) return false;
  const standard = parser["~standard"] as { jsonSchema?: unknown };
  return typeof standard.jsonSchema === "object";
}

function isObjectSchema(
  schema: JsonSchema,
): schema is Tool["inputSchema"] & JsonSchema {
  return schema.type === "object";
}

// Builds the tool input schema from the procedure's `.input()` parsers.
// tRPC merges chained object inputs, so their properties are merged here too.
function toInputSchema(inputs: unknown[], path: string): Tool["inputSchema"] {
  const schemas = inputs.map((parser) => {
    if (!hasJsonSchema(parser)) {
      throw new TypeError(
        `[trpc-to-mcp] The input of "${path}" can't be converted to JSON Schema. Use a validator that implements Standard JSON Schema, such as zod >=4.2, ArkType, or Valibot with toStandardJsonSchema().`,
      );
    }
    const schema = parser["~standard"].jsonSchema.input(JSON_SCHEMA_OPTIONS);
    if (!isObjectSchema(schema)) {
      throw new TypeError(
        `[trpc-to-mcp] The input of "${path}" must be an object schema, because MCP tool arguments are always an object.`,
      );
    }
    return schema;
  });

  const [first, ...rest] = schemas;
  if (!first) return { type: "object", properties: {} };
  if (rest.length === 0) return first;

  return {
    type: "object",
    properties: Object.assign({}, ...schemas.map((s) => s.properties)),
    required: [...new Set(schemas.flatMap((s) => s.required ?? []))],
  };
}

// Output schemas are optional in MCP, so any parser that can't produce an
// object schema (for example one with transforms) is skipped.
function toOutputSchema(output: unknown): Tool["outputSchema"] {
  if (!hasJsonSchema(output)) return undefined;
  try {
    const schema = output["~standard"].jsonSchema.output(JSON_SCHEMA_OPTIONS);
    return isObjectSchema(schema) ? schema : undefined;
  } catch {
    return undefined;
  }
}

/** Lists the MCP-enabled procedures of a router as MCP tool definitions. */
export function extractToolsFromProcedures(router: AnyTRPCRouter): McpTool[] {
  // `_def.procedures` is flat at runtime, keyed by the dotted procedure path.
  const procedures: Record<string, AnyTRPCProcedure> = router._def.procedures;
  const tools: McpTool[] = [];

  for (const [path, procedure] of Object.entries(procedures)) {
    const { type, inputs, meta } = procedure._def;
    const mcp = (meta as McpMeta | undefined)?.mcp;
    if (!mcp?.enabled) continue;

    if (type === "subscription") {
      throw new TypeError(
        `[trpc-to-mcp] "${path}" is a subscription. Only queries and mutations can be MCP tools.`,
      );
    }

    tools.push({
      name: mcp.name ?? path.replace(/\./g, "_"),
      title: mcp.title,
      description: mcp.description,
      annotations:
        type === "query"
          ? { readOnlyHint: true, ...mcp.annotations }
          : mcp.annotations,
      inputSchema: toInputSchema(inputs, path),
      outputSchema:
        "output" in procedure._def
          ? toOutputSchema(procedure._def.output)
          : undefined,
      path,
      type,
      transform: getMcpTransform(procedure),
    });
  }

  return tools;
}

// Registers a JSON Schema with the MCP SDK without validating against it.
// tRPC runs the procedure's own parsers on every call, and validating twice
// would apply zod transforms twice.
function advertise(schema: JsonSchema): StandardSchemaWithJSON {
  return {
    "~standard": {
      version: 1,
      vendor: "trpc-to-mcp",
      validate: (value) => ({ value }),
      jsonSchema: { input: () => schema, output: () => schema },
    },
  };
}

/**
 * Registers every MCP-enabled procedure of `router` as a tool on `server`.
 * Calls go through tRPC's normal pipeline (middlewares, input and output
 * validation), and errors come back to the client as `isError` results.
 */
export function registerTrpcTools<TRouter extends AnyTRPCRouter>(
  server: McpServer,
  router: TRouter,
  ctx: McpContext<TRouter>,
) {
  // A tRPC context is never a function, so a function here is a context factory.
  const createContext =
    typeof ctx === "function" ? (ctx as McpContextFactory<TRouter>) : () => ctx;

  return extractToolsFromProcedures(router).map((tool) =>
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        annotations: tool.annotations,
        inputSchema: advertise(tool.inputSchema),
        outputSchema: tool.outputSchema && advertise(tool.outputSchema),
      },
      async (args, mcpCtx: ServerContext): Promise<CallToolResult> => {
        const output: unknown = await callTRPCProcedure({
          router,
          path: tool.path,
          type: tool.type,
          ctx: await createContext(mcpCtx),
          getRawInput: async () => args,
          signal: mcpCtx.mcpReq.signal,
          batchIndex: 0,
        });

        const content = tool.transform
          ? await tool.transform(output)
          : [{ type: "text" as const, text: JSON.stringify(output ?? null) }];

        return tool.outputSchema
          ? { content, structuredContent: output as Record<string, unknown> }
          : { content };
      },
    ),
  );
}
