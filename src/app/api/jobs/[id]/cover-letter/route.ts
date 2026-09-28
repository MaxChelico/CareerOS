import { Document, Packer, Paragraph, TextRun } from "docx";
import { getCoverLetter } from "@/lib/cover-letter";
import { getJob } from "@/lib/jobs";

// Downloads the job's cover letter as a Word document.
export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]/cover-letter">) {
  const { id } = await ctx.params;
  const job = getJob(Number(id));
  const letter = job && getCoverLetter(job.id);
  if (!job || !letter) return new Response("Not found", { status: 404 });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } }, // 11 pt
    sections: [
      {
        children: letter.content.split(/\n\s*\n/).map(
          (para) =>
            new Paragraph({
              spacing: { after: 200 },
              // Keep single line breaks inside a paragraph (e.g. "Sincerely,\nName").
              children: para.split("\n").map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 })),
            }),
        ),
      },
    ],
  });

  const filename = `CoverLetter_${job.company.replace(/[^\w-]+/g, "")}.docx`;
  return new Response(new Uint8Array(await Packer.toBuffer(doc)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
