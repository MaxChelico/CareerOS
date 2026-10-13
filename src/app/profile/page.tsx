import { Chat } from "@/components/Chat";
import { AddItemForm, ProfileItemCard } from "@/components/ProfileItem";
import { ResumeUpload } from "@/components/ResumeUpload";
import { SubmitButton } from "@/components/SubmitButton";
import { listMessages } from "@/lib/chat";
import { listResumeHistory } from "@/lib/resume-versions";
import { formatDate } from "@/lib/dates";
import { getProfile, listItems, type Profile, type ProfileItem } from "@/lib/profile";
import { SECTIONS, type Section } from "@/lib/profile-sections";
import { addItem, deleteItem, saveContact } from "./actions";

export default function ProfilePage() {
  const profile = getProfile();
  const items = listItems();

  if (!profile?.resume_imported_at && items.length === 0) {
    return (
      <div className="m-auto w-full max-w-md px-6">
        <h1 className="text-lg font-semibold">Set up your profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload your resume and CareerOS will sort it into education, experience, projects and skills. You can
          review and correct everything afterwards.
        </p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <ResumeUpload replacing={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{profile?.name || "Your profile"}</h1>
      {profile?.headline && <p className="mt-0.5 text-slate-600">{profile.headline}</p>}
      <p className="mt-3 max-w-2xl text-sm text-slate-500">
        This is what CareerOS knows about you. Cover letters and interview prep only draw on what&apos;s here, so
        keep it accurate. Hover over an entry to edit or remove it.
      </p>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {SECTIONS.filter((s) => s.id !== "skill").map((section) => (
            <EntriesSection key={section.id} section={section} items={items.filter((i) => i.section === section.id)} />
          ))}
          <SkillsSection items={items.filter((i) => i.section === "skill")} />
          <div className="grid gap-5 sm:grid-cols-2">
            {profile && <ResumeCard profile={profile} />}
            <ContactSection profile={profile} />
          </div>
        </div>
        <div className="lg:sticky lg:top-4 lg:col-span-2 lg:h-[calc(100vh-2rem)]">
          <Chat
            thread="profile"
            initialMessages={listMessages("profile")}
            markers={listResumeHistory().map((v) => ({ at: v.imported_at, label: `📄 Resume imported: ${v.filename}` }))}
            title="Resume coach"
            intro="Ask anything about your resume and job search. The coach sees your profile and won't invent experience you don't have."
            placeholder="Ask about your resume…"
            starters={[
              "What are the strongest and weakest parts of my resume?",
              "Help me make my Encepta bullets more impactful.",
              "What kinds of roles am I best positioned for?",
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function EntriesSection({ section, items }: { section: Section; items: ProfileItem[] }) {
  return (
    <Card title={section.label}>
      {section.id === "story" && items.length === 0 && (
        <p className="px-3 text-sm text-slate-500">
          Short stories from your experience in Situation, Task, Action, Result form. Interview prep will use these.
        </p>
      )}
      <div className="-mx-1 divide-y divide-slate-100">
        {items.map((item) => (
          <ProfileItemCard key={item.id} item={item} section={section} />
        ))}
      </div>
      <AddItemForm section={section} />
    </Card>
  );
}

function ResumeCard({ profile }: { profile: Profile }) {
  return (
    <Card title="Resume">
      {profile.resume_imported_at ? (
        <p className="text-sm">
          <a href="/api/resume" target="_blank" className="font-medium text-sky-700 hover:underline">
            {profile.resume_filename}
          </a>
          <span className="block text-xs text-slate-500">Imported {formatDate(profile.resume_imported_at)}</span>
        </p>
      ) : (
        <p className="text-sm text-slate-500">No resume imported.</p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Upload a new version</summary>
        <div className="mt-2">
          <ResumeUpload replacing={Boolean(profile.resume_imported_at)} />
        </div>
      </details>
    </Card>
  );
}

function SkillsSection({ items }: { items: ProfileItem[] }) {
  // Group skills under their category, keeping the resume's order.
  const groups = new Map<string, ProfileItem[]>();
  for (const skill of items) {
    const key = skill.subtitle || "Other";
    groups.set(key, [...(groups.get(key) ?? []), skill]);
  }

  return (
    <Card title="Skills">
      <div className="space-y-3">
        {[...groups].map(([category, skills]) => (
          <div key={category}>
            <p className="mb-1.5 text-xs font-medium text-slate-500">{category}</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={skill.id}
                  className="group inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-sm"
                >
                  {skill.title}
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={skill.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${skill.title}`}
                      className="px-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </form>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form action={addItem} className="mt-3 flex gap-2">
        <input type="hidden" name="section" value="skill" />
        <input name="title" required placeholder="Add a skill" className="field" autoComplete="off" />
        <input name="subtitle" list="skill-categories" placeholder="Category" className="field w-32" />
        <datalist id="skill-categories">
          {[...groups.keys()].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </form>
    </Card>
  );
}

function ContactSection({ profile }: { profile?: Profile }) {
  const fields = [
    { name: "name", label: "Name" },
    { name: "headline", label: "Headline" },
    { name: "email", label: "Email" },
    { name: "phone", label: "Phone" },
    { name: "location", label: "Location" },
  ] as const;

  return (
    <Card title="Contact details">
      <form action={saveContact} className="space-y-2">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="mb-0.5 block text-xs font-medium text-slate-500">{f.label}</span>
            <input name={f.name} defaultValue={profile?.[f.name]} className="field" />
          </label>
        ))}
        <label className="block">
          <span className="mb-0.5 block text-xs font-medium text-slate-500">Links (one per line)</span>
          <textarea name="links" rows={3} defaultValue={profile?.links} className="field" />
        </label>
        <div className="flex justify-end">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
