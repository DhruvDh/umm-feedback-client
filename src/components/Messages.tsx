import {
  createEffect,
  createResource,
  createSignal,
  mergeProps,
  onMount,
  Suspense,
} from "solid-js";
import type { ChatCompletionRequestMessage } from "openai";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { createClient } from "@supabase/supabase-js";

interface MessagesProps {
  uuid: string;
}

const supabase = createClient(
  "https://uyancztmzjlekojeproj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo"
);

const getMessages = async (
  uuid: string
): Promise<ChatCompletionRequestMessage[]> => {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", uuid)
    .single();

  if (error) throw error;

  return data.messages;
};

export default function Messages(props: MessagesProps) {
  const { uuid } = mergeProps({ uuid: "" }, props);
  const [messages] = createResource(uuid, getMessages);
  const [markdown, setMarkdown] = createSignal("");

  createEffect(() => {
    if (messages.loading) {
      setMarkdown("Loading...");
    } else if (messages.error) {
      setMarkdown("Error loading messages.");
    } else {
      let result = "";
      for (const message of messages()) {
        const name = message.name ?? message.role;
        const text = message.content;

        console.log(text);
        result += `\n\n### ${name} Message\n\n${text}`;
      }

      setMarkdown(result);
    }
  });

  return (
    <article class="mx-auto p-4 prose">
      <hr />
      <h2>Information shared with AI</h2>
      <blockquote>
        The following is a transcript of information shared with the AI, in
        order for the above feedback to be generated. If certain important
        information is missing, that might be why the AI's feedback is not as
        helpful.
      </blockquote>
      <div
        innerHTML={micromark(markdown(), {
          extensions: [gfm()],
          htmlExtensions: [gfmHtml()],
        })}
      />
    </article>
  );
}
