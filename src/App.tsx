import { Route, Routes } from "@solidjs/router";
import { Component, lazy } from "solid-js";
import Prompts from "./components/Prompts";
import Submissions from "./components/Submissions";
import { createClient } from "@supabase/supabase-js";
import { ChatCompletionRequestMessage } from "openai";
const Feedback = lazy(() => import("./components/Feedback"));

const supabase = createClient(
  "https://uyancztmzjlekojeproj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YW5jenRtempsZWtvamVwcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA4NDA1NzgsImV4cCI6MTk3NjQxNjU3OH0.yMvOYM0AM61v6MRsHUSgO0BPrQHTde2AiKzE0b4H4lo",
);

interface PromptRow {
  id: string;
  reqName: string;
  grade: string;
  reason: string;
  messages: ChatCompletionRequestMessage[];
  length?: number;
  previousPrompt?: string;
}

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
    id: uuid,
    reqName,
    grade,
    reason,
    messages,
  };
};

const App: Component = () => {
  return (
    <Routes>
      <Route path="/prompts/:id" component={Prompts} />
      <Route path="/submissions/:id" component={Submissions} />
      <Route path="/:id" component={Feedback} />
    </Routes>
  );
};

export default App;
export { supabase, getQuery };