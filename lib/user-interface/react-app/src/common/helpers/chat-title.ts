import { TaskOptions } from "../constants";

// Task chats are saved with the hidden task instructions as their first message
// ("summarize - You are an AI specialized..."). Show those as "Summarize task" instead.
export function displayChatTitle(title?: string | null): string {
  if (!title) return "Untitled chat";
  const match = title.match(/^(\w+) - You are\b/);
  if (!match) return title;
  const taskTitle = TaskOptions.taskPromptMap[match[1]]?.taskTitle ?? match[1];
  return `${taskTitle} task`;
}
