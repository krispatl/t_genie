export const dynamic = "force-dynamic";
export async function GET() {
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  return Response.json(
    { enabled, locked: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
