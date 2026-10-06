export function authorize(
  request: Request,
): { status: number; error: string } | null {
  if (!process.env.OPENAI_API_KEY)
    return {
      status: 503,
      error:
        "Genie isn’t connected yet. You can explore the studio with the sample designs.",
    };
  const origin = request.headers.get("origin");
  if (origin) {
    // Next.js may reconstruct request.url using an internal proxy hostname.
    // Compare the browser origin to the request's public Host instead.
    const host = request.headers.get("host") || new URL(request.url).host;
    try {
      const parsed = new URL(origin);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.host !== host
      )
        return {
          status: 403,
          error: "This request must come from the studio.",
        };
    } catch {
      return { status: 403, error: "Invalid request origin." };
    }
  }
  return null;
}
const windows = new Map<string, { count: number; until: number }>();
async function allowRequest(bucket: string, limit: number) {
  // The studio is open for testing. Keep an overall limit for each API rather
  // than trusting user-supplied forwarded IP headers.
  const key = `t-genie:${bucket}:studio`;
  const now = Date.now();
  const windowId = Math.floor(now / 3600000);
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/pipeline`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", `${key}:${windowId}`],
          ["EXPIRE", `${key}:${windowId}`, "3700"],
        ]),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error("Rate limit service unavailable");
    const result = await response.json();
    if (
      !Array.isArray(result) ||
      typeof result[0]?.result !== "number" ||
      result.some((entry) => entry.error)
    )
      throw new Error("Invalid rate limit response");
    return result[0].result <= limit;
  }
  const previous = windows.get(key);
  const current =
    previous && previous.until > now
      ? previous
      : { count: 0, until: now + 3600000 };
  current.count += 1;
  windows.set(key, current);
  return current.count <= limit;
}
export const allowGeneration = () => allowRequest("generation", 12);
export const allowAgentTurn = () => allowRequest("agent", 120);
