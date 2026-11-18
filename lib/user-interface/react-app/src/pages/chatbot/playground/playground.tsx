import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";

export default function Playground() {
  const { sessionId } = useParams();

  return (
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using the chat</Header>}>
          <p>
            Type a question or request in the message box and press Enter or Send. GENIE remembers
            the conversation, so you can ask follow-up questions.
          </p>
          <h3>Ask about a document</h3>
          <p>
            Click Attach, choose up to 5 documents or images, then ask your question. The files stay
            with the conversation for follow-up questions.
          </p>
          <h3>Smart Model</h3>
          <p>
            Smart Model is the default. It sends each question to a model that suits it. You can
            also choose a model yourself from the list under the message box.
          </p>
          <h3>Settings</h3>
          <p>
            The settings button next to the model list controls answer length and whether answers
            appear word by word. Turn on Details to see which model answered.
          </p>
          <h3>Chat history</h3>
          <p>
            Every conversation is saved. Find past chats in{" "}
            <Link to="/chatbot/sessions">History</Link>.
          </p>
        </HelpPanel>
      }
      toolsWidth={300}
      content={<Chat sessionId={sessionId} />}
    />
  );
}
