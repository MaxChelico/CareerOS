"use server";

import { clearThread, parseThread } from "@/lib/chat";

export async function clearChat(thread: string) {
  if (!parseThread(thread)) throw new Error("Unknown conversation");
  clearThread(thread);
}
