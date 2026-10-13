"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { clearChat } from "@/app/chat-actions";

// created_at is missing for messages sent in this visit; they count as "now".
type Message = { role: "user" | "assistant"; content: string; created_at?: string };

// Something that happened outside the conversation, shown as a divider at the right point in it.
export type ChatMarker = { at: string; label: string };

export function Chat({
  thread,
  initialMessages,
  title,
  intro,
  placeholder,
  starters = [],
  markers = [],
}: {
  thread: string;
  initialMessages: Message[];
  title: string;
  intro: string;
  placeholder: string;
  starters?: string[]; // one-click first messages shown while the chat is empty
  markers?: ChatMarker[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // Markers after `after` and up to `until` (undefined = no bound). Timestamps are ISO-style strings,
  // so comparing them as text compares them as times.
  const markersBetween = (after: string | undefined, until: string | undefined) =>
    markers.filter((mk) => (after === undefined || mk.at > after) && (until === undefined || mk.at <= until));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as replies stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setDraft("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    const appendToReply = (chunk: string) =>
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + chunk }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, message }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToReply(value);
      }
    } catch {
      appendToReply("⚠️ Couldn't send that message. Is CareerOS still running?");
    } finally {
      setSending(false);
    }
  }

  async function startOver() {
    if (!confirm("Clear this conversation?")) return;
    await clearChat(thread);
    setMessages([]);
  }

  return (
    <section className="flex h-full min-h-[28rem] flex-col rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
        {messages.length > 0 && (
          <button onClick={startOver} disabled={sending} className="text-xs text-slate-400 hover:text-slate-900">
            Start over
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{intro}</p>
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Fragment key={i}>
            {/* Markers (e.g. a new resume import) that happened just before this message. */}
            {markersBetween(messages[i - 1]?.created_at, m.created_at).map((mk) => (
              <MarkerLine key={mk.at + mk.label} label={mk.label} />
            ))}
            {m.role === "user" ? (
              <div className="ml-8 rounded-lg bg-slate-900 px-3 py-2 text-sm whitespace-pre-wrap text-white">
                {m.content}
              </div>
            ) : (
              <div className="chat-md mr-4 text-sm text-slate-800">
                {m.content ? <Markdown>{m.content}</Markdown> : <span className="text-slate-400">Thinking…</span>}
              </div>
            )}
          </Fragment>
        ))}
        {messages.length > 0 &&
          markersBetween(messages.at(-1)?.created_at, undefined).map((mk) => (
            <MarkerLine key={mk.at + mk.label} label={mk.label} />
          ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="border-t border-slate-100 p-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter adds a new line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          placeholder={placeholder}
          disabled={sending}
          className="field resize-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Enter to send · Shift+Enter for a new line</span>
          <button type="submit" disabled={sending || !draft.trim()} className="btn-primary">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MarkerLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-slate-500" role="note">
      <span className="h-px flex-1 bg-slate-200" />
      {label}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
