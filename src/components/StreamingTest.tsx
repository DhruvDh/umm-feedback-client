import { onCleanup, onMount, createSignal } from "solid-js";
import SafeMarkdown from "./SafeMarkdown";
import { createStreamingMarkdown } from "../lib/streaming";

const DEMO_MARKDOWN = `# Streaming Renderer Test

> _"All streaming bugs are obvious once you see them."_

This page simulates the feedback streaming path **without touching Supabase**. It exercises:

1. Headings, emphasis, and blockquotes.
2. Tables, code fences, and inline code.
3. Links that open in new tabs (to ensure sanitization hooks run).

| Feature        | Expected Behaviour                         | Notes |
| -------------- | ------------------------------------------- | ----- |
| Chunk pipeline | Updates gradually without layout thrash     | ✔     |
| Markdown       | GFM extensions (tables, strikethrough) work | ✔     |
| Sanitization   | Unsafe links get \`rel="noopener noreferrer"\`        | ✔     |

~~~ts
function fibonacci(n: number): number {
  return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
}
~~~

Visit [Solid Docs](https://www.solidjs.com){target="_blank"} for more patterns, or ~~ignore~~ explore the rest of the UI.

Feel free to replace this string with the markdown you want to test.`;

function chunkMarkdown(source: string, chunkSize = 160): string[] {
  const chunks: string[] = [];
  let remaining = source;

  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }
    let slice = remaining.slice(0, chunkSize);
    const lastWhitespace = slice.lastIndexOf(" ");
    if (lastWhitespace > 40) {
      slice = slice.slice(0, lastWhitespace + 1);
    }
    chunks.push(slice);
    remaining = remaining.slice(slice.length);
  }

  return chunks;
}

export default function StreamingTest() {
  const streaming = createStreamingMarkdown();
  const [status, setStatus] = createSignal("Preparing stream…");
  const chunks = chunkMarkdown(DEMO_MARKDOWN);

  onMount(() => {
    streaming.reset("", false);
    setStatus("Streaming test content…");

    let index = 0;
    const interval = window.setInterval(() => {
      if (index >= chunks.length) {
        streaming.markDone();
        setStatus("Stream complete.");
        window.clearInterval(interval);
        return;
      }
      streaming.appendChunk(chunks[index]);
      index += 1;
    }, 120);

    onCleanup(() => window.clearInterval(interval));
  });

  return (
    <article class="mx-auto p-4 prose max-w-3xl">
      <h1>Streaming Renderer Test</h1>
      <blockquote>{status()}</blockquote>
      <SafeMarkdown source={streaming.displayed()} />
    </article>
  );
}
