import { useParams } from "@solidjs/router";
import {
  Show,
  createEffect,
  createResource,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import Messages from "./Messages";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { supabase } from "../lib/supabase";
import { getPromptById } from "../lib/prompts";
import SafeMarkdown from "./SafeMarkdown";
import { isValidUUID } from "../lib/validators";
import { createStreamingMarkdown } from "../lib/streaming";

class RetriableError extends Error {}
class FatalError extends Error {}

export default function Feedback() {
  const params = useParams();
  const uuid = params["id"];
  const streaming = createStreamingMarkdown();
  const feedback = streaming.value;
  const displayedFeedback = streaming.displayed;
  const feedbackDone = streaming.done;
  const [feedbackUploaded, setFeedbackUploaded] = createSignal(false);
  const [prompt] = createResource(
    () => (isValidUUID(uuid) ? uuid : false),
    async (id: string) => getPromptById(id),
  );

  const [foundInDB, setFoundInDB] = createSignal(false);
  const [connectionOpened, setConnectionOpened] = createSignal(false);
  const [connectionMessage, setConnectionMessage] = createSignal("");

  createEffect(() => {
    if (!uuid || !isValidUUID(uuid)) {
      setConnectionMessage("Invalid or missing ID.");
    } else if (prompt.loading) {
      setConnectionMessage("Loading...");
    } else if (prompt.error) {
      setConnectionMessage("Error finding ID in database. Is the URL correct?");
    }
  });

  createEffect(() => {
    if (feedbackDone() && !feedbackUploaded() && !foundInDB()) {
      const id = isValidUUID(uuid) ? uuid : null;
      const response = feedback().trim();
      if (!id || response.length === 0) return;
      (async () => {
        const { error } = await supabase
          .from("feedback")
          .upsert({ id, response }, { onConflict: "id" });
        if (error) {
          console.error("Failed to persist feedback", error);
          return;
        }
        setFeedbackUploaded(true);
      })();
    }
  });

  onMount(async () => {
    if (!uuid || !isValidUUID(uuid)) {
      setConnectionMessage("Invalid or missing ID.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("response")
        .eq("id", uuid)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const response = data.response ?? "";
        streaming.reset(response, true);
        setFoundInDB(true);
        setConnectionMessage("Loaded previously generated feedback.");
        return;
      }
    } catch (e) {
      console.error("Error loading stored feedback", e);
    }

    setConnectionMessage("Connecting to server, loading feedback...");
    streaming.reset("", false);

    const ctrl = new AbortController();
    onCleanup(() => ctrl.abort());

    try {
      await fetchEventSource(`https://umm-feedback-openai.deno.dev/${uuid}`, {
        method: "GET",
        signal: ctrl.signal,
        async onopen(response) {
          const contentType = response.headers.get("content-type") ?? "";
          if (response.ok && contentType.startsWith("text/event-stream")) {
            setConnectionMessage("Connected. Streaming feedback…");
            setConnectionOpened(true);
          } else if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            setConnectionMessage(
              "Unable to connect with the provided link. Please verify the ID.",
            );
            throw new FatalError();
          } else {
            console.log("Retrying... ", response);
            setConnectionMessage("Connection interrupted. Retrying…");
            throw new RetriableError();
          }
        },
        onmessage(ev) {
          try {
            const payload = JSON.parse(ev.data);
            if (payload.data) {
              streaming.appendChunk(payload.data);
            }
            if (payload.done) {
              streaming.markDone();
            }
          } catch (parseError) {
            console.warn("Skipping malformed SSE chunk", parseError);
          }
        },
        onclose() {
          setConnectionMessage("Connection closed.");
          setConnectionOpened(false);
        },
        onerror(err) {
          setConnectionMessage("Network issue encountered. Retrying…");
          if (err instanceof FatalError) {
            throw err;
          }
        },
      });
    } catch (err) {
      console.error("Error streaming feedback", err);
    }
  });

  return (
    <article class="mx-auto p-4 prose max-w-3xl">
      <h1>{prompt()?.reqName}</h1>
      <h3>{prompt()?.grade}</h3>
      <h3>{prompt()?.reason}</h3>
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
            <Show
              when={connectionMessage().trim().length > 0}
              fallback={
                <>
                  Connecting to server, loading feedback: <code>{uuid}</code>...
                </>
              }
            >
              {connectionMessage()}
            </Show>
          </blockquote>
        </Match>
        <Match when={feedbackDone()}>
          <blockquote>Feedback generated!</blockquote>
        </Match>
      </Switch>
      <SafeMarkdown source={displayedFeedback()} />
      <Messages uuid={uuid} feedbackDone={feedbackDone} />
    </article>
  );
}
