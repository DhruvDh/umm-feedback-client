import { useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  Match,
  onMount,
  Switch,
} from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import Messages from "./Messages";
import { supabase, getQuery } from "../App";
import { fetchEventSource } from "@microsoft/fetch-event-source";

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
    }
  });

  createEffect(() => {
    if (feedbackDone() && !feedbackUploaded() && !foundInDB()) {
      supabase
        .from("feedback")
        .insert({ id: uuid, response: feedback() })
        .then((res) => {
          console.log(res);
        });
      setFeedbackUploaded(true);
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
      setConnectionMessage("Connecting to server, loading feedback...");

      await fetchEventSource(`https://umm-feedback-openai.deno.dev/${uuid}`, {
        method: "GET",
        signal: ctrl.signal,
        async onopen(response) {
          if (
            response.ok &&
            response.headers.get("content-type") === "text/event-stream"
          ) {
            setConnectionMessage("Connection opened.");
            setConnectionOpened(true);
          } else if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            throw new FatalError();
          } else {
            console.log("Retrying... ", response);
            throw new RetriableError();
          }
        },
        onmessage(ev) {
          const data = JSON.parse(ev.data);
          if (feedback() === undefined) {
            setFeedback(data.data);
            // check if data has a key called 'data'
          } else if (data.data) {
            setFeedback(feedback() + data.data);
          } else if (data.done) {
            setFeedbackDone(true);
          }
        },
        onclose() {
          setConnectionMessage("Connection closed.");
          setConnectionOpened(false);
        },
        onerror(err) {
          setConnectionMessage("Fatal error occurred.");
          throw err;
        },
      });
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
