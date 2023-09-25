import { createEffect, createResource, createSignal } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "@solidjs/router";

interface SubmissionProps {
  uuid: string;
}

const supabase = createClient(
  "https://uyancztmzjlekojeproj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo",
);

interface SubmissionRow {
  id: string;
  course: string;
  term: string;
  content: string;
}

const getQuery = async (uuid: string): Promise<SubmissionRow> => {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", uuid)
    .single();

  if (error) throw error;

  let course = data.course ?? "No course specified";
  let term = data.term ?? "No term specified";
  let content = data.content ?? "No content specified";

  return {
    id: uuid,
    course,
    term,
    content,
  };
};

export default function Submissions(props: SubmissionProps) {
  const params = useParams();
  const uuid = params["id"];
  const [submission] = createResource(uuid, getQuery);

  const [markdown, setMarkdown] = createSignal("");

  createEffect(() => {
    if (submission.loading) {
      setMarkdown("Loading...");
    } else if (submission.error) {
      setMarkdown("Error loading messages.");
    } else {
      setMarkdown(submission().content);
    }
  });

  return (
    <article class="mx-auto prose max-w-3xl">
      <div
        innerHTML={micromark(markdown(), {
          extensions: [gfm()],
          htmlExtensions: [gfmHtml()],
        })}
      />
    </article>
  );
}
