import "server-only";
import { db } from "./db";
import { now } from "./dates";
import type { SectionId } from "./profile-sections";

export type Profile = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  resume_filename: string;
  resume_stored_name: string;
  resume_imported_at: string | null;
};

export type ContactFields = Pick<Profile, "name" | "headline" | "email" | "phone" | "location" | "links">;

export type ProfileItem = {
  id: number;
  section: SectionId;
  title: string; // degree, job title, project name, skill name, or story title
  subtitle: string; // school, company, or skill category
  dates: string;
  details: string; // one bullet per line
  source: "resume" | "manual";
  position: number;
};

export type ItemFields = Pick<ProfileItem, "section" | "title" | "subtitle" | "dates" | "details">;

// ---------- Reads ----------

export function getProfile(): Profile | undefined {
  return db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile | undefined;
}

export function listItems(): ProfileItem[] {
  return db.prepare("SELECT * FROM profile_items ORDER BY position, id").all() as ProfileItem[];
}

// ---------- Writes ----------

/**
 * Replace everything that came from the previous resume with a freshly imported one.
 * Contact fields and manually added items are left alone unless the new resume fills them.
 */
export function replaceResume(
  resume: { filename: string; stored_name: string },
  contact: ContactFields,
  items: ItemFields[],
): string | undefined {
  return db.transaction(() => {
    const previous = getProfile();
    db.prepare(
      `INSERT INTO profile (id, name, headline, email, phone, location, links,
                            resume_filename, resume_stored_name, resume_imported_at)
       VALUES (1, @name, @headline, @email, @phone, @location, @links, @filename, @stored_name, @stamp)
       ON CONFLICT (id) DO UPDATE SET
         name = COALESCE(NULLIF(@name, ''), name),
         headline = COALESCE(NULLIF(@headline, ''), headline),
         email = COALESCE(NULLIF(@email, ''), email),
         phone = COALESCE(NULLIF(@phone, ''), phone),
         location = COALESCE(NULLIF(@location, ''), location),
         links = COALESCE(NULLIF(@links, ''), links),
         resume_filename = @filename,
         resume_stored_name = @stored_name,
         resume_imported_at = @stamp`,
    ).run({ ...contact, ...resume, stamp: now() });

    db.prepare("DELETE FROM profile_items WHERE source = 'resume'").run();
    const insert = db.prepare(
      `INSERT INTO profile_items (section, title, subtitle, dates, details, source, position)
       VALUES (@section, @title, @subtitle, @dates, @details, 'resume', @position)`,
    );
    items.forEach((item, position) => insert.run({ ...item, position }));

    // Return the old PDF's stored name so the caller can delete the file.
    return previous?.resume_stored_name || undefined;
  })();
}

export function updateContact(contact: ContactFields) {
  db.prepare(
    `INSERT INTO profile (id, name, headline, email, phone, location, links)
     VALUES (1, @name, @headline, @email, @phone, @location, @links)
     ON CONFLICT (id) DO UPDATE SET name = @name, headline = @headline, email = @email,
       phone = @phone, location = @location, links = @links`,
  ).run(contact);
}

export function addItem(item: ItemFields) {
  // New manual items go to the end of their section.
  const { next } = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM profile_items").get() as {
    next: number;
  };
  db.prepare(
    `INSERT INTO profile_items (section, title, subtitle, dates, details, source, position)
     VALUES (@section, @title, @subtitle, @dates, @details, 'manual', @position)`,
  ).run({ ...item, position: next });
}

export function updateItem(id: number, item: Omit<ItemFields, "section">) {
  const { title, subtitle, dates, details } = item;
  db.prepare("UPDATE profile_items SET title = ?, subtitle = ?, dates = ?, details = ? WHERE id = ?").run(
    title,
    subtitle,
    dates,
    details,
    id,
  );
}

export function deleteItem(id: number) {
  db.prepare("DELETE FROM profile_items WHERE id = ?").run(id);
}
