import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import DOMPurify from "dompurify";
import { createMemo, JSX } from "solid-js";

interface SafeMarkdownProps {
  source: string | undefined | null;
  class?: string;
}

const sanitizerOptions: DOMPurify.Config = {
  FORBID_ATTR: ["style"],
  ADD_ATTR: ["target", "rel"],
  FORBID_TAGS: ["style"],
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export default function SafeMarkdown(props: SafeMarkdownProps): JSX.Element {
  const html = createMemo(() => {
    const raw = micromark(props.source ?? "", {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    });
    return DOMPurify.sanitize(raw, sanitizerOptions);
  });

  return <div class={props.class} innerHTML={html()} />;
}
