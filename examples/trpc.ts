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
