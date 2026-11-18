import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";
import TaskChat from "../../../components/chatbot/task-chat";
import TaskPriming from "../../../components/chatbot/task";
import { ChatBotTask } from "../../../components/chatbot/types";
import { TaskOptions } from "../../../common/constants";


export default function TaskPlayground() {
  const { sessionId } = useParams();
  const { prompt } = useParams(); 
  
  
  

  // const { task } = useParams();

  // const findTask = TaskPriming(prompt); THIS WAS CAUSING AN ERROR FOR SOME REASON

  // NEXT STEP IS IMPORT THE CONSTANTS IN HERE TO FIND THE MAP
  const promptOptions = TaskOptions.taskPromptMap; 
  // try {
  //   const taskName = promptOptions[prompt];
  //   console.log("task found in playground :)")
  //   const instructions = taskName.instructions; 
  //   const apiPrompt = taskName.prompt; 

  //   const cbTask2: ChatBotTask = {
  //     name: prompt,
  //     instructions: instructions, 
  //     apiPrompt: apiPrompt
  //   }; 
  // } catch (error) {
    
    
  // }

  // HARDCODED
  // const cbTask: ChatBotTask = {
  //   name: "Summarize",
  //   instructions: "Enter the text to be summarized below", 
  //   apiPrompt: "You are an AI specialized in key-point text summarization. Your task is to read extensive texts and distill them into concise summaries that emphasize the most critical points and central ideas. Aim to highlight significant facts, conclusions, and insights, stripping away any extraneous details. This enables users to grasp the essence of the content swiftly and effectively. Handle various document types, from academic articles to business reports, with precision. If the input text is ambiguous or the instruction lacks specifics, seek further clarification to ensure your summary aligns perfectly with the user's expectations.",
  // }

  // does the look up, 
  const taskName = promptOptions[prompt];
  if (!taskName) {
    console.log("Task not found")

  }
  console.log("task found in playground :)" + prompt) //prompt here is the name of the task
  const instructions = taskName.instructions; //what the user is told to input
  const apiPrompt = taskName.prompt; //what the ai is told to enhance the prompt 
  //console.log("apiPrompt" + apiPrompt);
  const sendPromptOnlyOnce = taskName.sendPromptOnlyOnce;

  const cbTask3: ChatBotTask = {
    name: prompt,
    instructions: instructions, 
    apiPrompt: apiPrompt,
    sendPromptOnlyOnce: sendPromptOnlyOnce
  }; 
  //console.log("cbTask3" + cbTask3);
  
  

  // console.log(prompt + "testing #85")
  return (
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using this task</Header>}>
          <p>
            A task is a ready-made starting point for one job, such as writing an
            email or summarizing a document. Read the instruction shown on the page
            to see what to enter.
          </p>
          <h3>Start a task</h3>
          <p>
            Type your details in the message box, then press Enter or Send. GENIE
            follows the task's instructions, so you do not need to explain the job
            again.
          </p>
          <h3>Follow-up questions</h3>
          <p>
            After the first answer, keep chatting in the same box. You can ask for
            changes, such as a shorter version or a different tone. GENIE remembers
            the conversation.
          </p>
          <h3>Attach a file</h3>
          <p>
            Click Attach to add up to 5 documents or images. The files stay with the
            conversation for follow-up questions.
          </p>
          <h3>Model and settings</h3>
          <p>
            Smart Model is the default. It sends each request to a model that suits
            it. You can choose a model yourself from the list under the message box,
            or use the settings button to change answer length and other options.
          </p>
          <h3>Task history</h3>
          <p>
            Every task is saved. Find past work in <Link to="/chatbot/sessions">History</Link>.
          </p>
        </HelpPanel>
      }
      toolsWidth={300}
      // 
      content={<TaskChat sessionId={sessionId} prompt={prompt} taskOb={cbTask3} />}
        />
        ); //send prompt here : prompt = {}
        }
