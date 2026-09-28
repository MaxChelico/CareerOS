import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/db";
import { getProfile } from "@/lib/profile";

// Serves the resume PDF the profile was imported from.
export async function GET() {
  const profile = getProfile();
  if (!profile?.resume_stored_name) return new Response("Not found", { status: 404 });

  const data = await fs.readFile(path.join(UPLOADS_DIR, path.basename(profile.resume_stored_name)));
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(profile.resume_filename)}`,
    },
  });
}
