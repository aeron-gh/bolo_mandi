import { randomBytes } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { connection } from "next/server";
import { backupTo } from "@/lib/backup.ts";
import { indiaDay } from "@/lib/history.ts";
import { errorResponse, ownerToken, shopFor } from "@/lib/server.ts";
import { assertOwner } from "@/lib/shop-api.ts";

// GET /api/backup -> a fresh copy of this shop's database as a file. Owner only once a PIN is set.
export async function GET(req: Request) {
  await connection();
  const file = path.join(tmpdir(), `bolo-${randomBytes(8).toString("hex")}.db`);
  try {
    const shop = shopFor(req);
    if (shop.mode === "demo") throw new Error("Demo dukaan ka backup nahi banta. Apna account banaiye.");
    assertOwner(shop.db, ownerToken(req), new Date());
    await backupTo(shop.db, file);
    return new Response(readFileSync(file), {
      headers: {
        "content-type": "application/vnd.sqlite3",
        "content-disposition": `attachment; filename="bolo-backup-${indiaDay(new Date())}.db"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    rmSync(file, { force: true });
  }
}
