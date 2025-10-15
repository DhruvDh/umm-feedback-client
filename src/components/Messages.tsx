import {
  Accessor,
  createEffect,
  createResource,
  createSignal,
  For,
  mergeProps,
  Show,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { ChatMessage } from "../lib/chat";
import { supabase } from "../lib/supabase";
import { getPromptById } from "../lib/prompts";
import SafeMarkdown from "./SafeMarkdown";
import { isValidUUID } from "../lib/validators";

interface MessagesProps {
  uuid: string;
  feedbackDone: Accessor<boolean>;
}

const promptResponse: Array<[string, ChatMessage]> = [
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
    props,
  );
  const navigate = useNavigate();
  const [prompt] = createResource(
    () => (isValidUUID(uuid) ? uuid : false),
    async (id: string) => getPromptById(id),
  );

  const [notSatisfiedMessage, setNotSatisfiedMessage] = createSignal("");
  const [notSatisfiedNote, setNotSatisfiedNote] = createSignal("", {
    equals: false,
  });
  const [markdown, setMarkdown] = createSignal("");

  createEffect(() => {
    if (!isValidUUID(uuid)) {
      setMarkdown("Invalid ID.");
    } else if (prompt.loading) {
      setMarkdown("Loading...");
    } else if (prompt.error) {
      setMarkdown("Error loading messages.");
    } else {
      let result = "";
      const current = prompt();
      if (current) {
        for (const message of current.messages) {
          const name = message.name ?? message.role;
          const text = message.content;

          result += name == "assistant"
            ? `\n\n### AI Teaching Assistant Message\n\n${text}`
            : `\n\n### ${name} Message\n\n${text}`;
        }
      }

      setMarkdown(result);
    }
  });

  const updatePrompt = async (
    uuid: string,
    newMessages: ChatMessage[],
  ) => {
    try {
      if (!isValidUUID(uuid)) {
        setNotSatisfiedMessage("Invalid ID.");
        return;
      }

      const current = prompt();
      if (!current) {
        setNotSatisfiedMessage("Prompt data has not loaded yet.");
        return;
      }

      setNotSatisfiedMessage("Updating prompt...");
      const { data, error } = await supabase
        .from("feedback")
        .select("response")
        .eq("id", uuid)
        .maybeSingle();

      if (error) {
        setNotSatisfiedMessage(
          "Error updating prompt, when getting previous prompt: " +
            error.message,
        );
        console.error(error);
        return;
      }

      const response = data?.response;
      if (typeof response !== "string" || response.trim().length === 0) {
        setNotSatisfiedMessage("No existing feedback available to extend.");
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("prompts")
        .insert({
          messages: [
            ...current.messages,
            {
              role: "assistant",
              content: response,
            },
            ...newMessages,
          ],
          length: (current.length ?? 0) + 1,
          previousPrompt: uuid,
          grade: current.grade,
          reason: current.reason,
          requirement_name: current.reqName,
          status: "not_started",
        })
        .select()
        .single();

      if (insertError) {
        setNotSatisfiedMessage("Error updating prompt: " + insertError.message);
        console.error(insertError);
        return;
      }

      if (!inserted || !inserted.id) {
        setNotSatisfiedMessage("Unable to load new prompt.");
        return;
      }

      setNotSatisfiedMessage("Navigating to prompt...");
      console.log(inserted);
      navigate(`/${inserted.id}`);
    } catch (err) {
      console.error(err);
      setNotSatisfiedMessage("Unexpected error updating prompt.");
    }
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
                    const note = notSatisfiedNote().trim();
                    if (note.length > 0) {
                      void updatePrompt(uuid, [
                        response[1],
                        {
                          role: "user",
                          content: note,
                          name: "Student",
                        },
                      ]);
                    } else {
                      void updatePrompt(uuid, [response[1]]);
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
            >
            </textarea>
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
        <SafeMarkdown source={markdown()} />
      </article>
    </Show>
  );
}
