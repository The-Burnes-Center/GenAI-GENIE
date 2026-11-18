import { ContentLayout, Header, SpaceBetween, Container, Box } from "@cloudscape-design/components";
import BaseAppLayout from "../../components/base-app-layout";

const READING_WIDTH = "760px";

export default function Documentation() {
  return (
    <BaseAppLayout
      contentType="default"
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="A short guide to GENIE, an AI assistant for everyday work."
            >
              Getting started
            </Header>
          }
        >
          <div style={{ maxWidth: READING_WIDTH, marginInline: "auto" }}>
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">What GENIE is</Header>}>
                <Box variant="p">
                  GENIE is an AI assistant. Type a question or a request, and it
                  writes an answer. You can also attach a file, such as a PDF or
                  a Word document, and ask questions about what is in it.
                </Box>
              </Container>

              <Container header={<Header variant="h2">Start a chat</Header>}>
                <ol>
                  <li>Type your question in the box at the bottom of the page.</li>
                  <li>Press Enter to send it. Press Shift and Enter to start a new line.</li>
                  <li>
                    Smart Model is selected by default. It picks a model that
                    suits your question.
                  </li>
                  <li>
                    To choose a model yourself, open the model menu under the
                    message box.
                  </li>
                </ol>
              </Container>

              <Container header={<Header variant="h2">Ask about a document</Header>}>
                <ol>
                  <li>Click Attach in the message box.</li>
                  <li>
                    Choose a PDF, Word, Excel, CSV or text file, or an image. You
                    can attach up to 5 files.
                  </li>
                  <li>Type your question and send it.</li>
                  <li>
                    Follow-up questions keep the file, so you can keep asking
                    about it without attaching it again.
                  </li>
                </ol>
              </Container>

              <Container header={<Header variant="h2">Use a task</Header>}>
                <Box variant="p">
                  On the home page, pick a task such as Summarize text or Draft a
                  memo. GENIE starts a chat that is already set up for that job,
                  so you only need to add your material.
                </Box>
              </Container>

              <Container header={<Header variant="h2">Compare models</Header>}>
                <Box variant="p">
                  Use Compare models in the side menu to ask one question and see
                  the answers from two or more models side by side. Choose a model
                  for each column, type your question, and send it.
                </Box>
              </Container>

              <Container header={<Header variant="h2">History</Header>}>
                <Box variant="p">
                  Your past chats are saved under History in the side menu. Open
                  one to pick up where you left off. You can also delete chats you
                  no longer need.
                </Box>
              </Container>

              <Container header={<Header variant="h2">Tips for good results</Header>}>
                <ul>
                  <li>
                    Be specific. "Summarize the key dates in this contract" works
                    better than "Help me."
                  </li>
                  <li>
                    Give context, such as who the answer is for and what you will
                    use it for.
                  </li>
                  <li>
                    Check important facts before you rely on them, especially
                    numbers, names and dates.
                  </li>
                  <li>
                    Never enter sensitive personal information, such as Social
                    Security numbers, bank details, passwords or health records.
                  </li>
                  <li>
                    Use the thumbs up and thumbs down buttons under an answer to
                    tell GENIE whether it helped.
                  </li>
                </ul>
              </Container>
            </SpaceBetween>
          </div>
        </ContentLayout>
      }
    />
  );
}
