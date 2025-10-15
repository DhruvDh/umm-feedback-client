import { createEffect, createResource, createSignal } from "solid-js";
import { useParams } from "@solidjs/router";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import SafeMarkdown from "./SafeMarkdown";
import { isValidUUID } from "../lib/validators";

interface SubmissionRow {
  id: string;
  course: string;
  term: string;
  content: string;
}

const SubmissionSchema = z.object({
  id: z.string(),
  course: z.string().nullish(),
  term: z.string().nullish(),
  content: z.string().nullish(),
});

const getQuery = async (uuid: string): Promise<SubmissionRow> => {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", uuid)
    .single();

  if (error) throw error;

  const parsed = SubmissionSchema.parse(data);

  return {
    id: uuid,
    course: parsed.course ?? "No course specified",
    term: parsed.term ?? "No term specified",
    content: parsed.content ?? "No content specified",
  };
};

export default function Submissions() {
  const params = useParams();
  const uuid = params["id"];
  const [submission] = createResource(
    () => (isValidUUID(uuid) ? uuid : false),
    async (id: string) => getQuery(id),
  );

  const [markdown, setMarkdown] = createSignal("");

  createEffect(() => {
    if (!isValidUUID(uuid)) {
      setMarkdown("Invalid ID.");
    } else if (submission.loading) {
      setMarkdown("Loading...");
    } else if (submission.error) {
      setMarkdown("Error loading submission.");
    } else {
      const current = submission();
      if (current) {
        setMarkdown(current.content);
      }
    }
  });

  return (
    <article class="mx-auto prose max-w-3xl">
      <SafeMarkdown source={markdown()} />
    </article>
  );
}
