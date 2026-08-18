export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok", aiConfigured: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
