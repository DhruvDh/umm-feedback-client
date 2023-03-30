import { createSignal, mergeProps } from "solid-js";
import type { ChatCompletionRequestMessage } from "openai";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

interface MessagesProps {
  messages: ChatCompletionRequestMessage[];
}

export default function Messages(props: MessagesProps) {
  const { messages } = mergeProps({ messages: [] }, props);
  const [markdown, setMarkdown] = createSignal("");

  let result =
    "---\n\n## Information shared with AI\n\n> The following is a transcript of information shared with the AI, in order for the above feedback to be generated. If certain important information is missing, that might be why the AI's feedback is not as helpful.";
  for (const message of messages) {
    const name = message.name ?? message.role;
    const text = message.content;

    console.log(text);
    result += `\n\n### ${name} Message\n\n${text}`;
  }

  setMarkdown(result);

  return (
    <article
      class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto"
      innerHTML={micromark(markdown(), {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      })}
    />
  );
}
