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
    "Your suggestions are too broad and vague.",
    {
      role: "user",
      content:
        "Thank you for your feedback, but your suggestions seem too vague for me to follow. Could you please provide more specific and actionable feedback, ideally in a step-by-step format?",
      name: "Student",
    },
  ],
  [
    "I don't understand.",
    {
      role: "user",
      content:
        "I appreciate your feedback, but I'm having trouble understanding it. Please rephrase your explanation or provide more context. Take a moment to think it over to help me grasp the concept more easily.",
      name: "Student",
    },
  ],
  [
    "Your suggestions work, but I don't understand why.",
    {
      role: "user",
      content:
        "Thank you for your feedback. I applied your recommended changes, and they worked. However, I'm unclear on the reasons behind their success. Could you please explain the thought process or concepts that led to these changes?",
      name: "Student",
    },
  ],
  [
    "The changes you suggested are unnecessary or already implemented in my submission.",
    {
      role: "user",
      content:
        "Thanks for your feedback. I believe I've already implemented the changes you suggested or that they are redundant. Could you please review my work again and point out any other areas that need improvement or clarification?",
      name: "Student",
    },
  ],
  [
    "Request alternate explanation/solution.",
    {
      role: "user",
      content:
        "Thank you for your feedback. However, I'm wondering if there's an alternate explanation or solution to the problem. Could you please think it over and provide another approach? Please ensure that the alternative you offer is meaningfuly different from this one.",
      name: "Student",
    },
  ],
  [
    "This explanation seems incorrect.",
    {
      role: "user",
      content:
        "Thank you for your feedback. However, I'm not convinced that the issue you pointed out is the root cause of the problem. Could you please review my work again and let me know if there are other concerns or areas that need attention after carefully considering the problem?",
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
        <div class="rounded-3xl pl-6 pr-6 pt-0.5 pb-2 bg-amber-100">
          <h2>Not satisfied with response?</h2>
          You can request new feedback by clicking on one of the following
          buttons that best describes your situation. If you want to share
          additional notes, you can also type them in the text box below.
          <Show when={notSatisfiedMessage().trim().length > 0}>
            <blockquote>{notSatisfiedMessage()}</blockquote>
          </Show>
          <div class="flex flex-col gap-2 m-6 place-content-between">
            <For each={promptResponse}>
              {(response) => (
                <button
                  class="rounded-lg p-2 border-gray-800 border-2 bg-white"
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
