import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/db";
import { getDocument } from "@/lib/jobs";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const doc = getDocument(Number(id));
  if (!doc) return new Response("Not found", { status: 404 });

  const data = await fs.readFile(path.join(UPLOADS_DIR, path.basename(doc.stored_name)));
  const type = TYPES[path.extname(doc.stored_name)] ?? "application/octet-stream";
  // PDFs open in the browser; everything else downloads.
  const disposition = type === "application/pdf" ? "inline" : "attachment";
  return new Response(data, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    },
  });
}
