import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

export interface StreamingState {
  value: Accessor<string>;
  displayed: Accessor<string>;
  done: Accessor<boolean>;
  appendChunk: (chunk: string) => void;
  reset: (initial?: string, markDone?: boolean) => void;
  markDone: () => void;
}

export function createStreamingMarkdown(throttleMs = 160): StreamingState {
  const [chunks, setChunks] = createSignal<string[]>([]);
  const [done, setDone] = createSignal(false);
  const value = createMemo(() => chunks().join(""));
  const [displayed, setDisplayed] = createSignal("");

  const updateDisplayed = () => setDisplayed(value());

  const interval = window.setInterval(() => {
    if (!done()) {
      updateDisplayed();
    }
  }, throttleMs);

  onCleanup(() => window.clearInterval(interval));

  createEffect(() => {
    if (done()) {
      updateDisplayed();
    }
  });

  const reset = (initial = "", markDone = false) => {
    setChunks(initial ? [initial] : []);
    setDone(markDone);
    setDisplayed(initial);
    if (markDone) {
      updateDisplayed();
    }
  };

  const appendChunk = (chunk: string) => {
    if (!chunk) return;
    setChunks((prev) => [...prev, chunk]);
  };

  const markDone = () => {
    setDone(true);
    updateDisplayed();
  };

  return {
    value,
    displayed,
    done,
    appendChunk,
    reset,
    markDone,
  };
}
