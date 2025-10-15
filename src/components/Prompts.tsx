import { createEffect, createResource, createSignal } from "solid-js";
import { useParams } from "@solidjs/router";
import { getPromptById } from "../lib/prompts";
import SafeMarkdown from "./SafeMarkdown";
import { isValidUUID } from "../lib/validators";

export default function Prompts() {
  const params = useParams();
  const uuid = params["id"];
  const [prompt] = createResource(
    () => (isValidUUID(uuid) ? uuid : false),
    async (id: string) => getPromptById(id),
  );

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

          result += `\n\n### ${name} Message\n\n${text}`;
        }
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
      <SafeMarkdown source={markdown()} />
    </article>
  );
}
