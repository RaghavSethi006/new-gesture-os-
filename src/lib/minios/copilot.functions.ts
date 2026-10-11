import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(1).max(500),
  catalog: z.string().min(2).max(8000),
});

const planSchema = z.object({
  steps: z
    .array(z.object({ capability: z.string(), args: z.record(z.string(), z.string()) }))
    .max(8),
  note: z.string().nullable(),
});

export type AiPlan = z.infer<typeof planSchema>;

const SYSTEM = `You translate a user's request into a plan for a desktop shell.
You may only use the capability ids given in the catalog, with the documented params.
A request can contain several commands — emit one step per command, in the order they should run.
Resolve pronouns ("it", "that window") using the open windows in the catalog.
If nothing in the catalog matches, return an empty steps array and explain why in "note".`;

async function callGemini(catalog: string, text: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Catalog:\n${catalog}\n\nRequest: ${text}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("AI planner is rate limited — try again shortly.");
    throw new Error("AI planning request failed.");
  }
  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

/** LLM fallback: used only when the deterministic planner cannot cover the text. */
export const planWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AiPlan> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!lovableKey && !geminiKey) return { steps: [], note: "AI planning is not configured." };

    let content = "{}";
    if (geminiKey && !lovableKey) {
      try {
        content = await callGemini(data.catalog, data.text, geminiKey);
      } catch (err) {
        return {
          steps: [],
          note: err instanceof Error ? err.message : "AI planning request failed.",
        };
      }
    } else {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey ?? "",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Catalog:\n${data.catalog}\n\nRequest: ${data.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "shell_plan",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["steps", "note"],
                properties: {
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["capability", "args"],
                      properties: {
                        capability: { type: "string" },
                        args: {
                          type: "object",
                          additionalProperties: false,
                          required: [
                            "target",
                            "app",
                            "zone",
                            "workspace",
                            "accent",
                            "title",
                            "value",
                            "text",
                            "anchor",
                            "mode",
                            "preset",
                          ],
                          properties: {
                            target: { type: ["string", "null"] },
                            app: { type: ["string", "null"] },
                            zone: { type: ["string", "null"] },
                            workspace: { type: ["string", "null"] },
                            accent: { type: ["string", "null"] },
                            title: { type: ["string", "null"] },
                            value: { type: ["string", "null"] },
                            text: { type: ["string", "null"] },
                            anchor: { type: ["string", "null"] },
                            mode: { type: ["string", "null"] },
                            preset: { type: ["string", "null"] },
                          },
                        },
                      },
                    },
                  },
                  note: { type: ["string", "null"] },
                },
              },
            },
          },
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        if (res.status === 429)
          return { steps: [], note: "AI planner is rate limited — try again shortly." };
        if (res.status === 402 || res.status === 403)
          return { steps: [], note: "AI planning is unavailable for this workspace." };
        throw new Error(`AI gateway ${res.status}: ${message.slice(0, 300)}`);
      }

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = payload.choices?.[0]?.message?.content ?? "{}";
    }
    const raw = JSON.parse(content) as unknown;
    const parsed = planSchema.safeParse(sanitize(raw));
    if (!parsed.success) return { steps: [], note: "AI returned an unusable plan." };
    return parsed.data;
  });

/** Drop null args so the registry sees only supplied values. */
function sanitize(raw: unknown): unknown {
  const value = raw as { steps?: unknown; note?: unknown };
  const steps = Array.isArray(value?.steps) ? value.steps : [];
  return {
    steps: steps.map((step) => {
      const s = step as { capability?: unknown; args?: Record<string, unknown> };
      const args: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.args ?? {})) {
        if (typeof v === "string" && v.trim()) args[k] = v;
      }
      return { capability: String(s.capability ?? ""), args };
    }),
    note: typeof value?.note === "string" ? value.note : null,
  };
}
