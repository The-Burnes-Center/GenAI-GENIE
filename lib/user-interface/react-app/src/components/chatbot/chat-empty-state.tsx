import { Box, Button, SpaceBetween } from "@cloudscape-design/components";

// Starter prompts for people who have never used an AI chat. Each fills the message box
// with a sentence to finish, so nothing is sent until the person adds their own details.
const STARTERS = [
  { label: "Draft an email", text: "Help me write a short, friendly email to my team about " },
  { label: "Summarize a document", text: "Summarize the attached document in five bullet points." },
  { label: "Explain in plain language", text: "Rewrite this in plain language that residents can understand: " },
  { label: "Plan a meeting", text: "Create an agenda for a 30-minute meeting about " },
];

export default function ChatEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <Box textAlign="center" padding={{ vertical: "xxl", horizontal: "m" }}>
      <SpaceBetween size="m">
        <Box variant="h1" tagOverride="h2">
          What can I help you with today?
        </Box>
        <Box color="text-body-secondary">
          Ask a question, attach a document, or start from one of these.
        </Box>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}
          role="group"
          aria-label="Starter prompts"
        >
          {STARTERS.map((starter) => (
            <Button key={starter.label} onClick={() => onPick(starter.text)}>
              {starter.label}
            </Button>
          ))}
        </div>
      </SpaceBetween>
    </Box>
  );
}
