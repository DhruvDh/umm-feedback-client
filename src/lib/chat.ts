export type ChatMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "function";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  name?: string;
}
