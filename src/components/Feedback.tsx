import { useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  Match,
  onMount,
  Switch,
} from "solid-js";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import Messages from "./Messages";
import { supabase, getQuery } from "../App";

class RetriableError extends Error {}
class FatalError extends Error {}

const ctrl = new AbortController();

export default function Feedback() {
  const params = useParams();
  const uuid = params["id"];
  const [feedback, setFeedback] = createSignal("");
  const [feedbackDone, setFeedbackDone] = createSignal(false);
  const [feedbackUploaded, setFeedbackUploaded] = createSignal(false);
  const [getPrompt] = createResource(uuid, getQuery);

  const [foundInDB, setFoundInDB] = createSignal(false);
  const [connectionOpened, setConnectionOpened] = createSignal(false);
  const [connectionMessage, setConnectionMessage] = createSignal("");

  createEffect(() => {
    if (uuid === undefined || uuid == "") {
      setConnectionMessage("No ID provided.");
    } else if (getPrompt.loading) {
      setConnectionMessage("Loading...");
    } else if (getPrompt.error) {
      setConnectionMessage(
        "Error finding ID in database. Is the URL correct?."
      );
    } else {
    }
  });

  onMount(async () => {
    if (uuid === undefined || uuid == "") {
      setConnectionMessage("No ID provided.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("id", uuid);

      if (error) throw error;

      setFeedback(data[0]?.response);
      setFeedbackDone(true);
      setFoundInDB(true);
    } catch (e) {
      await fetchEventSource(`https://umm-feedback-openai.deno.dev/${uuid}`, {
        method: "GET",
        signal: ctrl.signal,
        openWhenHidden: true,
        async onopen(response) {
          setConnectionOpened(true);
          if (
            response.ok &&
            response.headers.get("content-type") == "text/event-stream"
          ) {
            setConnectionMessage("Connected to OpenAI, loading...");
            return; // everything's good
          } else if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            let m =
              `Fatal error (status ${response.status}): ` +
              JSON.stringify(response) +
              "\nIt is likely the conversation is too long or malformed.";
            setConnectionMessage(m);
            ctrl.abort(m);
            // client-side errors are usually non-retriable:
            throw new FatalError();
          } else {
            setConnectionMessage(
              "Retriable error (something has gone wrong that is not fatal, you should be able to retry in a few minutes.): " +
                response.statusText
            );

            throw new RetriableError();
          }
        },
        onmessage(msg) {
          // if the server emits an error message, throw an exception
          // so it gets handled by the onerror callback below:
          if (msg.event === "FatalError") {
            setConnectionMessage(
              "Fatal error: " +
                JSON.stringify(msg) +
                "\nIt is likely the conversation is too long."
            );
            ctrl.abort(
              "Fatal error: " +
                JSON.stringify(msg) +
                "\nIt is likely the conversation is too long."
            );

            throw new FatalError(msg.data);
          }
          const data = msg.data;
          if (typeof data === "string" && data.trim() === "[DONE]") {
            if (!feedbackDone()) {
              setFeedbackDone(true);
            }
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
              if (!feedbackDone()) {
                setFeedbackDone(true);
              }
            }
          }
        },
        onclose() {
          if (feedbackDone()) {
            setConnectionMessage("Done!");
            setFeedbackDone(true);
            ctrl.abort("Done!");
          } else {
            setConnectionMessage(
              "Connection closed unexpectedly. (something has gone wrong that is not fatal, you should be able to retry in a few minutes.)"
            );
            ctrl.abort(
              "Connection closed unexpectedly. (something has gone wrong that is not fatal, you should be able to retry in a few minutes.)"
            );

            // if the server closes the connection unexpectedly, retry:
            throw new RetriableError();
          }
        },
        onerror(err) {
          if (err.message.trim() == "") {
            setConnectionMessage("Done!");
            setFeedbackDone(true);
            ctrl.abort("Done!");
            throw err;
          } else {
            setConnectionMessage("Error: " + err.message);
            ctrl.abort("Error: " + err.message);
            throw err;
          }
        },
      });
    }
  });
  createEffect(() => {
    if (feedbackDone() && !feedbackUploaded()) {
      supabase
        .from("feedback")
        .insert({ id: uuid, response: feedback() })
        .then((res) => {
          console.log(res);
        });
      setFeedbackUploaded(true);
    }
  });

  return (
    <article class="mx-auto p-4 prose max-w-3xl">
      <h1>{getPrompt()?.reqName}</h1>
      <h3>{getPrompt()?.grade}</h3>
      <h3>{getPrompt()?.reason}</h3>
      <hr />
      <h2>AI Feedback</h2>
      <Switch
        fallback={
          <blockquote>Something is wrong. Cannot generate feedback.</blockquote>
        }
      >
        <Match when={foundInDB() && !connectionOpened()}>
          <blockquote>Found previously generated feedback.</blockquote>
        </Match>
        <Match when={connectionOpened()}>
          <blockquote>{connectionMessage()}</blockquote>
        </Match>
        <Match when={!connectionOpened() && !feedbackDone()}>
          <blockquote>
            Connecting to server, loading feedback: <code>{uuid}</code>...
          </blockquote>
        </Match>
        <Match when={feedbackDone()}>
          <blockquote>Feedback generated!</blockquote>
        </Match>
      </Switch>
      <div
        innerHTML={micromark(feedback(), {
          extensions: [gfm()],
          htmlExtensions: [gfmHtml()],
        })}
      />
      <Messages uuid={uuid} feedbackDone={feedbackDone} />
    </article>
  );
}
