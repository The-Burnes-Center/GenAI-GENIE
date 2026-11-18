import BaseAppLayout from "../../../components/base-app-layout";
import MultiChat from "../../../components/chatbot/multi-chat";
import {
  ContentLayout,
  Header,
  HelpPanel,
} from "@cloudscape-design/components";
import { Link } from "react-router-dom";

export default function MultiChatPlayground() {
  return (
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using compare models</Header>}>
          <p>
            Each column uses its own model. Choose a model in each column, then
            type one question. It is sent to every model at once.
          </p>
          <h3>Settings</h3>
          <p>
            Use the settings button in a column to change options for that
            model, such as how creative its answers are. Turn on Show details to
            see extra information about each answer.
          </p>
          <h3>Chat history</h3>
          <p>
            Your conversations are saved. You can find them under{" "}
            <Link to="/chatbot/sessions">History</Link> in the side menu.
          </p>
        </HelpPanel>
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Ask once and see answers from two or more models side by side."
            >
              Compare models
            </Header>
          }
        >
          <MultiChat />
        </ContentLayout>
      }
    />
  );
}
