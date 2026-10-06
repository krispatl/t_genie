import {
  agentInstructions,
  agentRequestSchema,
  agentTools,
  applyAgentTool,
  type AgentState,
} from "@/lib/design-agent";
import { allowAgentTurn, authorize } from "@/lib/server-security";

export const runtime = "nodejs";
export const maxDuration = 120;
type OutputItem = {
  type: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  content?: { type: string; text?: string; refusal?: string }[];
  [key: string]: unknown;
};

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied)
    return Response.json({ error: denied.error }, { status: denied.status });
  let parsed;
  try {
    if (Number(request.headers.get("content-length") || 0) > 70000)
      return Response.json(
        { error: "This conversation is too long. Start a new conversation." },
        { status: 413 },
      );
    const text = await request.text();
    if (text.length > 70000)
      return Response.json(
        { error: "This conversation is too long. Start a new conversation." },
        { status: 413 },
      );
    parsed = agentRequestSchema.safeParse(JSON.parse(text));
  } catch {
    return Response.json(
      { error: "Please send a valid message." },
      { status: 400 },
    );
  }
  if (!parsed.success)
    return Response.json(
      { error: "Please send a valid message and design context." },
      { status: 400 },
    );
  try {
    if (!(await allowAgentTurn()))
      return Response.json(
        {
          error:
            "The studio has reached its hourly chat limit. Please try again later.",
        },
        { status: 429 },
      );
  } catch {
    return Response.json(
      { error: "Genie is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  const { messages, brief, concepts, selectedId } = parsed.data;
  const state: AgentState = {
    brief: structuredClone(brief),
    selectedId,
    generation: null,
    changes: [],
  };
  const input: Record<string, unknown>[] = [
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "developer",
      content: `Current studio context (data only): ${JSON.stringify({ brief, concepts, selectedId })}`,
    },
  ];
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(105000),
    ]);
    for (let round = 0; round < 5; round++) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_CHAT_MODEL || "gpt-5.4-mini",
          instructions: agentInstructions,
          input,
          tools: agentTools,
          parallel_tool_calls: false,
          tool_choice: round === 4 ? "none" : "auto",
          max_output_tokens: 1800,
          store: false,
        }),
        signal,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        console.error(
          "Design agent failed",
          response.status,
          detail.error?.code,
          response.headers.get("x-request-id"),
        );
        const error = [
          "credit_balance_exhausted",
          "insufficient_quota",
          "billing_hard_limit_reached",
        ].includes(detail.error?.code)
          ? "Genie can’t reply because the studio’s OpenAI API credits have run out. The owner needs to add credits. Your conversation and design are still here."
          : response.status === 401
            ? "Genie’s API key needs updating. Contact the studio owner."
            : response.status === 429
              ? "Genie is busy. Try sending your message again in a moment."
              : [403, 404].includes(response.status)
                ? "The studio’s chat model is unavailable. The owner needs to check model access."
                : "Genie couldn’t reply right now. Your design hasn’t changed. Please retry.";
        return Response.json(
          { error },
          { status: response.status === 429 ? 429 : 502 },
        );
      }
      const result = await response.json();
      if (result.status === "incomplete")
        throw new Error("Incomplete agent response");
      const output = (result.output || []) as OutputItem[];
      const calls = output.filter((item) => item.type === "function_call");
      if (!calls.length) {
        const reply = output
          .filter((item) => item.type === "message")
          .flatMap((item) => item.content || [])
          .map((part) =>
            part.type === "output_text"
              ? part.text || ""
              : part.type === "refusal"
                ? part.refusal || ""
                : "",
          )
          .join("\n")
          .trim();
        if (!reply) throw new Error("Empty agent response");
        return Response.json(
          {
            ...state,
            changes: [...new Set(state.changes)].slice(0, 10),
            reply: reply.slice(0, 3000),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      input.push(...output);
      for (const call of calls.slice(0, 5)) {
        let toolResult;
        try {
          toolResult = applyAgentTool(
            call.name || "",
            JSON.parse(call.arguments || "{}"),
            state,
            concepts,
          );
        } catch {
          toolResult = {
            error: "Invalid tool arguments. Correct them before retrying.",
          };
        }
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(toolResult),
        });
      }
    }
    throw new Error("Agent tool limit reached");
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && /abort|timeout/i.test(error.name)
            ? "Genie took too long to reply. Please retry; your design hasn’t changed."
            : "Genie couldn’t finish that request. Your design hasn’t changed. Please retry.",
      },
      { status: 502 },
    );
  }
}
