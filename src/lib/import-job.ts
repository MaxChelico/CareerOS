import "server-only";

export type ImportedJob = {
  company: string;
  title: string;
  location: string;
  description: string;
  source: string;
};

export type ImportResult = { ok: true; job: ImportedJob } | { ok: false; error: string };

const PASTE_HINT = "Paste the job description below instead.";

/**
 * Fetch a job posting and pull out its details, in order of reliability:
 * 1. Greenhouse / Lever / Ashby / ADP Workforce Now postings, via those platforms' public job APIs.
 * 2. A schema.org "JobPosting" JSON-LD block, which many career sites embed.
 * 3. The page's title and description metadata.
 */
export async function importJobFromUrl(rawUrl: string): Promise<ImportResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "That doesn't look like a valid web address." };
  }

  try {
    const fromApi = await importFromJobBoardApi(url);
    if (fromApi) return { ok: true, job: tidy(fromApi) };
  } catch (err) {
    // Fall through to reading the page itself.
    console.warn(`Job board lookup failed for ${url.hostname}:`, err);
  }

  const source = guessSource(url.hostname);
  const loginWalled = /linkedin\.com|indeed\.com/.test(url.hostname);

  let html: string;
  try {
    const res = await get(url, "text/html");
    if (!res.ok) {
      return { ok: false, error: `The site responded with an error (${res.status}). ${PASTE_HINT}` };
    }
    html = await res.text();
  } catch {
    return { ok: false, error: `Couldn't reach that page. ${PASTE_HINT}` };
  }

  const posting = findJobPosting(html);
  if (posting) {
    const org = posting.hiringOrganization;
    return {
      ok: true,
      job: {
        company: text(typeof org === "string" ? org : org?.name),
        title: text(posting.title),
        location: formatLocation(posting.jobLocation),
        description: htmlToText(text(posting.description)),
        source,
      },
    };
  }

  // No structured data: use the page's title and main text, and let the user tidy up the rest.
  const siteName = decodeEntities(meta(html, "og:site_name") ?? "").trim();
  const title = stripSiteName(
    decodeEntities(meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim(),
    siteName,
  );
  const mainText = pageMainText(html);
  const description =
    mainText.length >= 200 ? mainText : decodeEntities(meta(html, "og:description") ?? meta(html, "description") ?? "");
  if (!title && !description) {
    return {
      ok: false,
      error: loginWalled
        ? `This site hides postings behind a login, so they can't be read automatically. ${PASTE_HINT}`
        : `Couldn't find job details on that page. ${PASTE_HINT}`,
    };
  }
  return {
    ok: true,
    job: tidy({ company: siteName, title, location: "", description, source }),
  };
}

// Collapse stray runs of spaces in the one-line fields ("Real  Estate" → "Real Estate").
function tidy(job: ImportedJob): ImportedJob {
  const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
  return { ...job, company: oneLine(job.company), title: oneLine(job.title), location: oneLine(job.location) };
}

// "Investment Banking Analyst | Agentis Capital" → "Investment Banking Analyst"
function stripSiteName(title: string, siteName: string): string {
  if (!siteName) return title;
  const suffix = new RegExp(`\\s*[|\\-–—:]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  return title.replace(suffix, "") || title;
}

/**
 * The readable text of a page's main content, for sites without structured job data.
 * Prefers the <main>/<article> landmark; otherwise the body minus headers, menus and footers.
 */
function pageMainText(html: string): string {
  const cleaned = html.replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, "");
  const landmark =
    cleaned.match(/<main\b[\s\S]*<\/main>/i)?.[0] ??
    cleaned.match(/<article\b[\s\S]*<\/article>/i)?.[0] ??
    cleaned.match(/<[a-z]+[^>]*role=["']main["'][\s\S]*$/i)?.[0] ??
    (cleaned.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? cleaned).replace(/<(header|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, "");
  return htmlToText(landmark)
    .replace(/[​‌‍﻿]/g, "") // zero-width characters some site builders insert
    .replace(/^[_\-–—=\s]{3,}$/gm, "") // decorative divider lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function get(url: URL | string, accept: string) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      Accept: accept,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
}

async function getJson(url: string) {
  const res = await get(url, "application/json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function guessSource(hostname: string): string {
  if (hostname.includes("linkedin.")) return "LinkedIn";
  if (hostname.includes("indeed.")) return "Indeed";
  return "Company site";
}

// ---------- Job-board APIs ----------

// "general-fusion" → "General Fusion". Lever and Ashby don't return a display name.
function companyFromSlug(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function importGreenhouseJob(board: string, jobId: string): Promise<ImportedJob> {
  const job = await getJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}`,
  );
  return {
    company: text(job.company_name) || companyFromSlug(board),
    title: text(job.title),
    location: text(job.location?.name),
    description: htmlToText(text(job.content)),
    source: "Company site",
  };
}

// Greenhouse's embed page accepts a bare job ID and redirects to an address naming the board
// (…/embed/job_app?for={board}&token={id}), which tells us which board the job belongs to.
async function findGreenhouseBoard(jobId: string): Promise<string | undefined> {
  const res = await get(`https://boards.greenhouse.io/embed/job_app?token=${encodeURIComponent(jobId)}`, "text/html");
  if (!res.ok) return undefined;
  const board = new URL(res.url).searchParams.get("for") ?? (await res.text()).match(/[?&]for=([\w-]+)/)?.[1];
  return board || undefined;
}

async function importFromJobBoardApi(url: URL): Promise<ImportedJob | undefined> {
  const [first, second, third] = url.pathname.split("/").filter(Boolean);

  // job-boards.greenhouse.io/{board}/jobs/{id}
  if (/(^|\.)greenhouse\.io$/.test(url.hostname) && second === "jobs" && third) {
    return importGreenhouseJob(first, third);
  }

  // A Greenhouse job embedded in a company's own careers page: ...?gh_jid={id}
  const ghJobId = url.searchParams.get("gh_jid");
  if (ghJobId && /^\d+$/.test(ghJobId)) {
    const board = await findGreenhouseBoard(ghJobId);
    if (board) return importGreenhouseJob(board, ghJobId);
  }

  // jobs.lever.co/{company}/{id}
  if (url.hostname === "jobs.lever.co" && first && second) {
    const job = await getJson(`https://api.lever.co/v0/postings/${first}/${second}`);
    const lists = ((job.lists ?? []) as { text: string; content: string }[])
      .map((l) => `${l.text}\n${htmlToText(l.content)}`)
      .join("\n\n");
    return {
      company: companyFromSlug(first),
      title: text(job.text),
      location: text(job.categories?.location),
      description: [text(job.descriptionPlain), lists, text(job.additionalPlain)].filter(Boolean).join("\n\n"),
      source: "Company site",
    };
  }

  // jobs.ashbyhq.com/{org}/{id} — Ashby only lists whole boards, so find the posting by id.
  if (url.hostname === "jobs.ashbyhq.com" && first && second) {
    const board = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${first}`);
    const job = (board.jobs as { id: string; title: string; location: string; descriptionPlain: string }[]).find(
      (j) => j.id === second,
    );
    if (!job) return undefined;
    return {
      company: companyFromSlug(first),
      title: job.title,
      location: job.location,
      description: job.descriptionPlain,
      source: "Company site",
    };
  }

  // workforcenow.adp.com/.../recruitment.html?cid={client}&jobId={id}. ADP's feed has no company
  // name field, so company is left blank for the user to fill in.
  const cid = url.searchParams.get("cid");
  const jobId = url.searchParams.get("jobId");
  if (url.hostname === "workforcenow.adp.com" && cid && jobId) {
    const params = new URLSearchParams({
      cid,
      ccId: url.searchParams.get("ccId") ?? "",
      lang: url.searchParams.get("lang") ?? "en_US",
      locale: url.searchParams.get("lang") ?? "en_US",
    });
    const job = await getJson(
      `https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/${encodeURIComponent(jobId)}?${params}`,
    );
    const locations = ((job.requisitionLocations ?? []) as { nameCode?: { shortName?: string } }[])
      .map((l) => text(l.nameCode?.shortName))
      .filter(Boolean);
    const salary = ((job.customFieldGroup?.stringFields ?? []) as { stringValue?: string; nameCode?: { codeValue?: string } }[])
      .find((f) => f.nameCode?.codeValue === "SalaryRange")?.stringValue;
    const description = htmlToText(text(job.requisitionDescription));
    return {
      company: "",
      title: text(job.requisitionTitle),
      location: locations.join(" · "),
      description: salary ? `Salary: ${salary}\n\n${description}` : description,
      source: "Company site",
    };
  }

  return undefined;
}

// ---------- JSON-LD ----------

// JSON-LD is loosely typed in the wild; these are the fields we read.
type JobPostingLd = {
  "@type"?: string | string[];
  title?: unknown;
  description?: unknown;
  hiringOrganization?: { name?: unknown } | string;
  jobLocation?: unknown;
};

function findJobPosting(html: string): JobPostingLd | undefined {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    try {
      const found = searchLd(JSON.parse(body.trim()));
      if (found) return found;
    } catch {
      // Malformed JSON-LD is common; skip it.
    }
  }
  return undefined;
}

function searchLd(node: unknown): JobPostingLd | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchLd(item);
      if (found) return found;
    }
    return undefined;
  }
  if (node && typeof node === "object") {
    const obj = node as JobPostingLd & { "@graph"?: unknown };
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
    if (obj["@graph"]) return searchLd(obj["@graph"]);
  }
  return undefined;
}

function formatLocation(loc: unknown): string {
  const places = (Array.isArray(loc) ? loc : [loc]).map((place) => {
    const address = (place as { address?: Record<string, unknown> } | undefined)?.address;
    if (!address) return "";
    return [address.addressLocality, address.addressRegion, address.addressCountry]
      .map((part) => text((part as { name?: unknown })?.name ?? part))
      .filter(Boolean)
      .join(", ");
  });
  return [...new Set(places.filter(Boolean))].join(" · ");
}

// ---------- HTML helpers ----------

function text(value: unknown): string {
  return typeof value === "string" ? decodeEntities(value).trim() : "";
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  return re.exec(html)?.[0].match(/content=["']([^"']*)["']/i)?.[1];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&[lr]squo;/g, "'")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&bull;/g, "•")
    .replace(/&larr;/g, "←")
    .replace(/&rarr;/g, "→")
    .replace(/&middot;/g, "·")
    .replace(/&copy;/g, "©")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)[a-z]+;/gi, "") // any other named entity: drop rather than show raw
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Turn a posting's HTML description into readable plain text, keeping list structure.
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|ul|ol|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/^•\n+(?=[^\n•])/gm, "• ") // a bullet whose text sat in its own paragraph
    .replace(/^•\s*$/gm, "") // empty bullets (e.g. list items holding only icons)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
