import {
  Accessor,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";
import { ChatCompletionRequestMessage } from "openai";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { supabase } from "../App";
import { useParams } from "@solidjs/router";

interface PromptProps {
  uuid: string;
  feedbackDone: Accessor<boolean>;
}

interface PromptRow {
  id: string;
  reqName: string;
  grade: string;
  reason: string;
  messages: ChatCompletionRequestMessage[];
  length?: number;
  previousPrompt?: string;
}

const getQuery = async (uuid: string): Promise<PromptRow> => {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", uuid)
    .single();

  if (error) throw error;

  let reqName = data.requirement_name ?? "ITSC 2214 Autograder Feedback";
  let grade = data.grade ?? "Not Found";
  let reason = data.reason ?? "";
  if (reason == "See above.") {
    reason = "See below.";
  }
  let messages: ChatCompletionRequestMessage[] = data.messages ?? [];

  return {
    id: uuid,
    reqName,
    grade,
    reason,
    messages,
  };
};

export default function Prompts(props: PromptProps) {
  const params = useParams();
  const uuid = params["id"];
  const [messages] = createResource(uuid, getQuery);

  const [markdown, setMarkdown] = createSignal("");

  createEffect(() => {
    if (messages.loading) {
      setMarkdown("Loading...");
    } else if (messages.error) {
      setMarkdown("Error loading messages.");
    } else {
      let result = "";
      for (const message of messages().messages) {
        const name = message.name ?? message.role;
        const text = message.content;

        result += `\n\n### ${name} Message\n\n${text}`;
      }

      setMarkdown(result);
    }
  });

  return (
    <article class="mx-auto p-4 prose max-w-3xl">
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
