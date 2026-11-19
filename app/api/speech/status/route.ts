export function GET() {
  return Response.json({ sarvam: false }, { headers: { "Cache-Control": "no-store" } });
}
