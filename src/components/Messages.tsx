import {
  Accessor,
  createEffect,
  createResource,
  createSignal,
  For,
  mergeProps,
  Show,
} from "solid-js";
import { ChatCompletionRequestMessage } from "openai";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { createClient } from "@supabase/supabase-js";

interface MessagesProps {
  uuid: string;
  feedbackDone: Accessor<boolean>;
}

const supabase = createClient(
  "https://uyancztmzjlekojeproj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo"
);

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
  let previousPrompt = data.previousPrompt;

  if (data["previousPrompt"] !== null) {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("id", previousPrompt)
      .single();

    messages.push({
      role: "assistant",
      content: data.response,
      name: "AI Teaching Assistant",
    });
  } else {
    console.log("No previous prompt found.");
  }

  return {
    id: uuid,
    reqName,
    grade,
    reason,
    messages,
  };
};

const promptResponse: Array<[string, ChatCompletionRequestMessage]> = [
  [
    "I don't understand.",
    {
      role: "user",
      content:
        "Thank you for your feedback. I'm having trouble understanding it. Could you please rephrase or provide more context, and take a moment to think it over before sharing your explanation to help me grasp the concept more easily?",
      name: "Student",
    },
  ],
  [
    "Your suggestions work, but I don't understand why.",
    {
      role: "user",
      content:
        "Thank you for your feedback. I applied the changes you recommended, and they were effective. However, I'm still unclear on the underlying reasons for their success. Please think it over and explain the thought process behind these changes in a way that helps me understand better.",
      name: "Student",
    },
  ],
  [
    "Changes requested are already in my code.",
    {
      role: "user",
      content:
        "Thank you for your feedback. I believe I've already implemented the changes you suggested. Please think it over and review my work once more, pointing out any other areas that are problematic or need improvement.",
      name: "Student",
    },
  ],
  [
    "This explanation is incorrect.",
    {
      role: "user",
      content:
        "Thank you for your feedback. I'm not sure if the issue you pointed out is the root cause of the problem. Please think it over and review my work again, letting me know if there are any other concerns or areas that need attention after your careful consideration",
      name: "Student",
    },
  ],
];

export default function Messages(props: MessagesProps) {
  const { uuid, feedbackDone } = mergeProps(
    { uuid: "", feedbackDone: () => false },
    props
  );
  const [messages] = createResource(uuid, getQuery);

  const [notSatisfiedMessage, setNotSatisfiedMessage] = createSignal("");
  const [notSatisfiedNote, setNotSatisfiedNote] = createSignal("", {
    equals: false,
  });
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

  const updatePrompt = function (
    uuid: string,
    newMessages: ChatCompletionRequestMessage[]
  ) {
    setNotSatisfiedMessage("Updating prompt...");
    supabase
      .from("prompts")
      .insert({
        messages: newMessages,
        length: (messages().length ?? 0) + 1,
        previousPrompt: uuid,
        grade: messages().grade,
        reason: messages().reason,
        requirement_name: messages().reqName,
        status: "not_started",
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          setNotSatisfiedMessage("Error updating prompt: " + error.message);
          throw error;
        } else {
          setNotSatisfiedMessage("Navigating to prompt...");
          console.log(data);
          window.open(`/${data.id}`, "_blank");
        }
      });
  };

  return (
    <Show when={feedbackDone()}>
      <article class="mx-auto p-4 prose max-w-3xl">
        <hr />
        <h2>Not satisfied with response?</h2>
        <Show when={notSatisfiedMessage().trim().length > 0}>
          <blockquote>{notSatisfiedMessage()}</blockquote>
        </Show>

        <div class="flex flex-col gap-2 m-6 place-content-between">
          <For each={promptResponse}>
            {(response) => (
              <button
                class="rounded-lg p-2 border-gray-800 border-2"
                onClick={() => {
                  if (notSatisfiedNote().trim().length > 0) {
                    updatePrompt(uuid, [
                      ...messages().messages,
                      response[1],
                      {
                        role: "user",
                        content: notSatisfiedNote(),
                        name: "Student",
                      },
                    ]);
                  } else {
                    updatePrompt(uuid, [...messages().messages, response[1]]);
                  }
                }}
              >
                {response[0]}
              </button>
            )}
          </For>
          <textarea
            class="rounded-lg p-6 border-gray-800 border-2 w-full border-dashed "
            onInput={(e) => {
              if (e.isTrusted) {
                setNotSatisfiedNote(e.currentTarget.value);
              }
            }}
            placeholder="Optionally provide additional notes here before clicking a button above. Please keep it short, otherwise it might error out."
          ></textarea>
        </div>
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
    </Show>
  );
}
