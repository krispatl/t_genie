export const dynamic = "force-dynamic";
export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  const enabled =
    configured &&
    (process.env.NODE_ENV !== "production" ||
      Boolean(process.env.STUDIO_ACCESS_CODE));
  return Response.json(
    { enabled, locked: enabled && Boolean(process.env.STUDIO_ACCESS_CODE) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
