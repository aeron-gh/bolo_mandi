import { reply, resetDemo, shopFor } from "@/lib/server.ts";

// POST /api/demo/reset -> the demo shop starts again from the sample data
export async function POST(req: Request) {
  return reply(() => {
    if (shopFor(req).mode !== "demo") throw new Error("Sirf demo dukaan reset hoti hai");
    resetDemo();
    return { reset: true };
  });
}
