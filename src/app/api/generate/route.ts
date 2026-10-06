import { generateSchema } from "@/lib/catalog";
import { allowGeneration, authorize } from "@/lib/server-security";

export const runtime = "nodejs";
export const maxDuration = 300;
const directions = [
  "Bold centered composition, expressive character, striking silhouette.",
  "Fresh alternate composition with a dynamic diagonal pose and playful details.",
  "A collectible concert-poster composition, dramatic lighting and fine linework.",
  "An adventurous alternate with a different angle, restrained palette and graphic shapes.",
];
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied)
    return Response.json({ error: denied.error }, { status: denied.status });
  if (Number(request.headers.get("content-length") || 0) > 12000)
    return Response.json(
      { error: "The description is too long." },
      { status: 413 },
    );
  let body;
  try {
    const text = await request.text();
    if (text.length > 12000)
      return Response.json(
        { error: "The description is too long." },
        { status: 413 },
      );
    body = generateSchema.safeParse(JSON.parse(text));
  } catch {
    return Response.json(
      { error: "Please send a valid design request." },
      { status: 400 },
    );
  }
  if (!body.success)
    return Response.json(
      { error: body.error.issues[0].message },
      { status: 400 },
    );
  try {
    if (!(await allowGeneration()))
      return Response.json(
        {
          error:
            "This studio has reached its hourly generation limit. Try again in an hour.",
        },
        { status: 429 },
      );
  } catch {
    return Response.json(
      {
        error:
          "Generation is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
  const settings = body.data;
  const abort = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    abort.signal,
    AbortSignal.timeout(250000),
  ]);
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (!closed && !request.signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };
      send({ type: "start", count: settings.count });
      await Promise.all(
        Array.from({ length: settings.count }, async (_, index) => {
          try {
            const response = await fetch(
              "https://api.openai.com/v1/images/generations",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model:
                    process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
                  prompt: `Create original artwork for an apparel print. User concept: ${settings.prompt}\nArt direction: ${settings.style}. ${directions[index]}\nThe print will appear on a ${settings.color} ${settings.garment}. Create the ARTWORK ONLY, no garment, product photograph, mockup, model or watermark. Isolate the composition on a genuinely transparent background. Use strong legible shapes, clean edges, and sufficient contrast. Keep the whole design within the canvas with breathing room. Include words only when explicitly requested in the concept.`,
                  n: 1,
                  size: "1024x1024",
                  quality: "medium",
                  background: "transparent",
                  output_format: "webp",
                  output_compression: 75,
                }),
                signal,
              },
            );
            if (!response.ok) {
              const detail = await response.json().catch(() => ({}));
              // Log only non-sensitive status/code/request ID; never prompts or credentials.
              console.error(
                "Image generation failed",
                response.status,
                detail.error?.code,
                response.headers.get("x-request-id"),
              );
              const message =
                response.status === 401
                  ? "The image service credentials need updating. Contact the studio owner."
                  : [
                        "credit_balance_exhausted",
                        "insufficient_quota",
                        "billing_hard_limit_reached",
                      ].includes(detail.error?.code)
                    ? "The studio’s OpenAI credits have run out. The owner needs to add API credits before new designs can be generated. You can still use the sample artwork."
                    : response.status === 429
                      ? "The image service is busy. Please try again in a moment."
                      : detail.error?.code === "moderation_blocked" ||
                          detail.error?.code === "content_policy_violation"
                        ? "This concept couldn’t be generated. Try adjusting the description."
                        : response.status === 403 || response.status === 404
                          ? "This image model isn’t available to the studio’s API account. Check model access and organization verification."
                          : "We couldn’t create this concept. Please try again.";
              send({ type: "error", index, message });
              return;
            }
            const result = await response.json();
            const data = result.data?.[0]?.b64_json;
            if (!data || data.length > 950000) {
              send({
                type: "error",
                index,
                message:
                  "The artwork could not be delivered within the preview size limit. Please try again.",
              });
              return;
            }
            send({
              type: "design",
              index,
              design: {
                id: crypto.randomUUID(),
                name: `Concept ${String(index + 1).padStart(2, "0")}`,
                prompt: settings.prompt,
                image: `data:image/webp;base64,${data}`,
                createdAt: Date.now(),
                source: "generated",
              },
            });
          } catch (error) {
            if (!closed && !request.signal.aborted)
              send({
                type: "error",
                index,
                message:
                  error instanceof Error && /abort|timeout/i.test(error.name)
                    ? "This concept took too long. Please try again."
                    : "The image service couldn’t be reached. Please try again.",
              });
          }
        }),
      );
      if (!closed) {
        send({ type: "done" });
        closed = true;
        controller.close();
      }
    },
    cancel() {
      closed = true;
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
