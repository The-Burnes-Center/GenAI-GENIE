import {
  BreadcrumbGroup,
  Box,
  Cards,
  Container,
  ContentLayout,
  Header,
  Link,
  SpaceBetween,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import RouterButton from "../components/wrappers/router-button";
import TaskGrid from "../components/task-grid";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";

interface FeatureCard {
  name: string;
  href: string;
  img: string;
  description: string;
  external?: boolean;
}

// Same proportion at every width, so wide single-column cards don't crop the art
const IMAGE_ASPECT_RATIO = "2 / 1";
const CARDS_PER_ROW = [{ cards: 1 }, { minWidth: 760, cards: 3 }];

const FEATURES: FeatureCard[] = [
  {
    name: "Chatbot",
    href: "/chatbot/playground",
    img: "/images/welcome/chatbotWhite.jpg",
    description: "Ask questions and get help with everyday tasks, using the model of your choice.",
  },
  {
    name: "Ask about your documents",
    href: "/chatbot/playground",
    img: "/images/welcome/documents.svg",
    description: "Upload a PDF, Word file or spreadsheet in the chat and ask questions about it.",
  },
  {
    name: "Compare models",
    href: "/chatbot/multichat",
    img: "/images/welcome/multichat.png",
    description: "Send one prompt to several models and compare their answers side by side.",
  },
];

const LEARNING: FeatureCard[] = [
  {
    name: "Learn what generative AI can do",
    href: "https://youtu.be/jNNatjruXx8?si=dRhLLnnBxiNByon4",
    img: "/images/welcome/bottom1.png",
    description: "Discover what generative AI can do and how to write prompts that save you time.",
    external: true,
  },
  {
    name: "How to upload documents",
    href: "https://youtu.be/2d-FeSmGzbk",
    img: "/images/welcome/bottom2.png",
    description: "A short video on adding documents to the chatbot.",
    external: true,
  },
  {
    name: "Prompt engineering guide",
    href: "https://www.promptingguide.ai/",
    img: "/images/welcome/bottom3.png",
    description: "How to write clear, specific prompts that get better answers.",
    external: true,
  },
];

function ImageCards({ items }: { items: FeatureCard[] }) {
  const onFollow = useOnFollow();
  return (
    <Cards
      trackBy="name"
      items={items}
      cardsPerRow={CARDS_PER_ROW}
      cardDefinition={{
        header: (item) => (
          <Link
            href={item.href}
            external={item.external}
            onFollow={item.external ? undefined : onFollow}
            fontSize="heading-m"
          >
            {item.name}
          </Link>
        ),
        sections: [
          {
            id: "image",
            content: (item) => (
              // Decorative: the card title already says what it is
              <img
                src={item.img}
                alt=""
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: IMAGE_ASPECT_RATIO,
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
            ),
          },
          {
            id: "description",
            content: (item) => <Box color="text-body-secondary">{item.description}</Box>,
          },
        ],
      }}
    />
  );
}

export default function Welcome() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup onFollow={onFollow} items={[{ text: CHATBOT_NAME, href: "/" }]} />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Chat with leading AI models, ask questions about your documents, and compare answers side by side."
              actions={
                <RouterButton iconAlign="right" iconName="contact" variant="primary" href="/documentation/doc">
                  Getting started
                </RouterButton>
              }
            >
              Welcome to GENIE
            </Header>
          }
        >
          <SpaceBetween size="xxl">
            <ImageCards items={FEATURES} />

            <SpaceBetween size="m">
              <Header
                variant="h2"
                description="Pick a task to start a chat that already knows what you need."
              >
                Tasks
              </Header>
              <TaskGrid />
            </SpaceBetween>

            <Container
              header={
                <Header variant="h2" description="Short videos and guides for getting more out of generative AI.">
                  Learn more
                </Header>
              }
            >
              <ImageCards items={LEARNING} />
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
