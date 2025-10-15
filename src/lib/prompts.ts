import { z } from "zod";
import type { ChatMessage } from "./chat";
import { supabase } from "./supabase";

export interface PromptRow {
  id: string;
  reqName: string;
  grade: string;
  reason: string;
  messages: ChatMessage[];
  length?: number;
  previousPrompt?: string;
}

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.string(),
  name: z.string().optional(),
});

const PromptRowSchema = z.object({
  id: z.string(),
  requirement_name: z.string().nullish(),
  grade: z.string().nullish(),
  reason: z.string().nullish(),
  messages: z.array(MessageSchema).nullable().optional(),
  length: z.number().nullable().optional(),
  previousPrompt: z.string().nullable().optional(),
});

export const getPromptById = async (uuid: string): Promise<PromptRow> => {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", uuid)
    .single();

  if (error) {
    throw error;
  }

  const parsed = PromptRowSchema.parse(data);

  const reqName = parsed.requirement_name ?? "ITSC 2214 Autograder Feedback";
  const grade = parsed.grade ?? "Not Found";
  let reason = parsed.reason ?? "";
  if (reason === "See above.") {
    reason = "See below.";
  }
  const messages: ChatMessage[] = parsed.messages ?? [];

  return {
    id: uuid,
    reqName,
    grade,
    reason,
    messages,
    length: parsed.length ?? undefined,
    previousPrompt: parsed.previousPrompt ?? undefined,
  };
};
