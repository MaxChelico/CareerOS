import type Anthropic from "@anthropic-ai/sdk";
import { BASE_PARAMS, claude, describeError } from "@/lib/ai";
import { addMessage, deleteMessage, listMessages, systemPrompt } from "@/lib/chat";

// Sends one chat message and streams Claude's reply back as plain text.
export async function POST(req: Request) {
  const { thread, message } = (await req.json()) as { thread?: unknown; message?: unknown };
  if (typeof thread !== "string" || typeof message !== "string" || !message.trim()) {
    return new Response("Bad request", { status: 400 });
  }
  const system = systemPrompt(thread);
  if (!system) return new Response("Unknown conversation", { status: 404 });

  const userMessageId = addMessage(thread, "user", message.trim());
  const history: Anthropic.Beta.BetaMessageParam[] = listMessages(thread).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        const stream = claude().beta.messages.stream({
          ...BASE_PARAMS,
          max_tokens: 16000,
          output_config: { effort: "low" }, // quick, conversational replies
          cache_control: { type: "ephemeral" }, // the profile in the system prompt is reused every turn
          system,
          messages: history,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !reply) {
          reply = "Sorry, I can't help with that one. Try rephrasing?";
          controller.enqueue(encoder.encode(reply));
        }
      } catch (err) {
        const notice = `\n\n⚠️ ${describeError(err)}`;
        controller.enqueue(encoder.encode(notice));
        if (!reply) {
          // Nothing useful was said; drop the unanswered message so the user can retry cleanly.
          deleteMessage(userMessageId);
          controller.close();
          return;
        }
      }
      if (reply) addMessage(thread, "assistant", reply);
      controller.close();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
