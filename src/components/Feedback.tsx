import { useParams } from "@solidjs/router";
import { createResource, createSignal, onMount } from "solid-js";
import { createClient } from "@supabase/supabase-js";
import type { ChatCompletionRequestMessage } from "openai";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

class RetriableError extends Error {}
class FatalError extends Error {}

interface PromptRow {
  reqName: string;
  grade: string;
  reason: string;
  messages: ChatCompletionRequestMessage[];
}

const supabase = createClient(
  "https://uyancztmzjlekojeproj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo"
);

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
    reqName,
    grade,
    reason,
    messages,
  };
};

export default function Home() {
  const params = useParams();
  const uuid = params["id"];
  const [feedback, setFeedback] = createSignal("");
  const [getPrompt] = createResource(uuid, getQuery);

  onMount(async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("id", uuid);

      if (error) throw error;

      setFeedback(data[0]?.response);
    } catch (e) {
      console.log(JSON.stringify(e));
      await fetchEventSource(
        "https://uyancztmzjlekojeproj.functions.supabase.co/openai-feedback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo",
          },
          body: JSON.stringify({
            prompt_id: uuid,
          }),
          async onopen(response) {
            console.log(response);
            if (
              response.ok &&
              response.headers.get("content-type") == "text/event-stream"
            ) {
              return; // everything's good
            } else if (
              response.status >= 400 &&
              response.status < 500 &&
              response.status !== 429
            ) {
              // client-side errors are usually non-retriable:
              throw new FatalError();
            } else {
              throw new RetriableError();
            }
          },
          onmessage(msg) {
            // if the server emits an error message, throw an exception
            // so it gets handled by the onerror callback below:
            if (msg.event === "FatalError") {
              throw new FatalError(msg.data);
            }
            const data = msg.data;
            if (data == "[DONE]") {
              return;
            } else {
              const val = JSON.parse(data);
              setFeedback(
                (prev) =>
                  (prev === undefined ? "" : prev) +
                  (val.choices[0].delta.content === undefined
                    ? ""
                    : val.choices[0].delta.content)
              );
              if (val.choices[0].finish_reason !== null) {
                supabase
                  .from("feedback")
                  .insert({ id: uuid, response: feedback() })
                  .then((res) => {
                    console.log(res);
                  });
              }
            }
          },
          onclose() {
            console.log("closed");
            // if the server closes the connection unexpectedly, retry:
            throw new RetriableError();
          },
          onerror(err) {
            console.log(err);
            throw err;
          },
        }
      );
    }
  });

  return (
    <article class="mx-auto p-4 prose">
      <h1> {getPrompt()?.reqName}</h1>
      <h3> {getPrompt()?.grade}</h3>
      <h3>{getPrompt()?.reason}</h3>
      <hr />
      <div
        innerHTML={micromark(feedback(), {
          extensions: [gfm()],
          htmlExtensions: [gfmHtml()],
        })}
      />
    </article>
  );
}
