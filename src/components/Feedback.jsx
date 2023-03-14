import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { SSE } from "sse.js";

import {
  createResource,
  createEffect,
  createSignal,
  mergeProps,
  onMount,
} from "solid-js";

const Feedback = function (props) {
  const { id } = mergeProps({ id: "" }, props);
  const [uuid, _] = createSignal(id);
  const [result, setResult] = createSignal("");
  const [markdown, setMarkdown] = createSignal("");

  onMount(async () => {
    const res = await fetch(
      "https://uyancztmzjlekojeproj.functions.supabase.co/openai-feedback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo",
        },
        body: JSON.stringify({ prompt_id: uuid() }),
      }
    );
    // Create a reader for the response body
    const reader = res.body.getReader();
    // Create a decoder for UTF-8 encoded text
    const decoder = new TextDecoder("utf-8");

    // Function to read chunks of the response body
    const readChunk = async () => {
      return reader.read().then(({ value, done }) => {
        if (!done) {
          const dataString = decoder.decode(value);
          const data = JSON.parse(`{${dataString}}`);
          console.log(data);

          if (data.error) {
            console.error("Error while generating content: " + data.message);
          } else {
            setResult(
              data.streamHead
                ? data.choices[0].delta
                : result + data.choices[0].delta
            );
            return readChunk();
          }
        } else {
          console.log("done");
        }
      });
    };

    await readChunk();
  });

  return (
    <>
      <div innerHTML={micromark(result())}></div>
    </>
  );
};

export default Feedback;
