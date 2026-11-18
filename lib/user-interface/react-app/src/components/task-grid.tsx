import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Cards,
  Icon,
  IconProps,
  Link,
  SpaceBetween,
} from "@cloudscape-design/components";
import * as awsui from "@cloudscape-design/design-tokens";
import { v4 as uuidv4 } from "uuid";
import useOnFollow from "../common/hooks/use-on-follow";

interface Task {
  route: string;
  title: string;
  description: string;
  icon: IconProps.Name;
}

// Route names match TaskOptions.taskPromptMap in common/constants.ts
const TASKS: Task[] = [
  { route: "summarize", title: "Summarize", description: "Summarize meeting notes, articles and memos.", icon: "file" },
  { route: "translate", title: "Translate", description: "Translate text into more than 24 languages.", icon: "suggestions" },
  { route: "meetingAgenda", title: "Create a meeting agenda", description: "Plan a focused agenda for an upcoming meeting.", icon: "calendar" },
  { route: "email", title: "Write an email", description: "Turn a rough draft into a clear, professional email.", icon: "envelope" },
  { route: "memo", title: "Draft a memo", description: "Draft a concise memo from a few notes.", icon: "edit" },
  { route: "dailyPlanning", title: "Plan my day", description: "Turn your to-do list into a plan for the day.", icon: "check" },
  { route: "toneCustomization", title: "Change the tone", description: "Rewrite text to sound friendlier, firmer or more formal.", icon: "audio-full" },
  { route: "documentFormatting", title: "Format a document", description: "Clean up the structure and formatting of your text.", icon: "script" },
  { route: "policyClarification", title: "Clarify a policy", description: "Ask questions about Massachusetts policies.", icon: "search" },
  { route: "positiveAffirmation", title: "Positive affirmation", description: "Start your workday with an encouraging note.", icon: "heart" },
];

const INITIAL_COUNT = 6;

function TaskIcon({ name }: { name: IconProps.Name }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        background: awsui.colorBackgroundStatusInfo,
        color: awsui.colorTextStatusInfo,
      }}
    >
      <Icon name={name} variant="link" />
    </span>
  );
}

export default function TaskGrid() {
  const onFollow = useOnFollow();
  const [showAll, setShowAll] = useState(false);

  // A fresh session id per page view, so each task opens a new chat
  const items = useMemo(
    () =>
      TASKS.map((task) => ({
        ...task,
        href: `/chatbot/task-playground/${uuidv4()}/${task.route}`,
      })),
    []
  );
  const visible = showAll ? items : items.slice(0, INITIAL_COUNT);

  return (
    <SpaceBetween size="m">
      <Cards
        trackBy="route"
        items={visible}
        cardsPerRow={[{ cards: 1 }, { minWidth: 560, cards: 2 }, { minWidth: 900, cards: 3 }]}
        cardDefinition={{
          header: (item) => (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TaskIcon name={item.icon} />
              <Link href={item.href} onFollow={onFollow} fontSize="heading-s">
                {item.title}
              </Link>
            </div>
          ),
          sections: [
            {
              id: "description",
              content: (item) => <Box color="text-body-secondary">{item.description}</Box>,
            },
          ],
        }}
      />
      <Box textAlign="center">
        <Button
          onClick={() => setShowAll(!showAll)}
          iconName={showAll ? "angle-up" : "angle-down"}
          ariaExpanded={showAll}
        >
          {showAll ? "Show fewer tasks" : `Show all ${TASKS.length} tasks`}
        </Button>
      </Box>
    </SpaceBetween>
  );
}
