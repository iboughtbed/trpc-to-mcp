import { initTRPC } from "@trpc/server";
import { z } from "zod";

import { transformMcpProcedure, type McpMeta } from "../src";

const t = initTRPC.meta<McpMeta>().create();

export const appRouter = t.router({
  weather: transformMcpProcedure(
    t.procedure
      .meta({
        mcp: {
          enabled: true,
          name: "get_weather",
          description: "Get the current weather for a city",
        },
      })
      .input(z.object({ city: z.string() }))
      .query(({ input }) => ({
        city: input.city,
        temperature: 21,
        conditions: ["sunny", "windy"],
      })),
    // `output` is typed from the query above.
    (output) => [
      {
        type: "text",
        text: `${output.city}: ${output.temperature}°C, ${output.conditions.join(" and ")}`,
      },
    ],
  ),
});
