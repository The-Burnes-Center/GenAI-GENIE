import { Button, Container, Spinner } from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import TextareaAutosize from "react-textarea-autosize";
import composer from "../../styles/composer.module.scss";

export interface MultiChatInputPanelProps {
  running: boolean;
  enabled: boolean;
  onSendMessage: (msg: string) => void;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function MultiChatInputPanel(props: MultiChatInputPanelProps) {
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
            window.scrollY -
            document.documentElement.scrollHeight
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  const send = () => {
    if (!props.enabled || value.trim().length === 0) return;
    props.onSendMessage(value);
    setValue("");
  };

  return (
    <div className={composer.composer}>
      <Container>
        <TextareaAutosize
          className={composer.textarea}
          minRows={2}
          maxRows={8}
          maxLength={10000}
          spellCheck={true}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key == "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          value={value}
          placeholder={listening ? "Listening..." : "Ask one question to compare the answers"}
          aria-label="Message"
        />
        <div className={composer.toolbar}>
          <div className={composer.toolbar_group}>
            {browserSupportsSpeechRecognition && (
              <Button
                iconName={listening ? "microphone-off" : "microphone"}
                variant="icon"
                ariaLabel={listening ? "Stop dictation" : "Dictate your message"}
                onClick={() =>
                  listening
                    ? SpeechRecognition.stopListening()
                    : SpeechRecognition.startListening()
                }
              />
            )}
          </div>
          <Button
            variant="primary"
            disabled={!props.enabled || value.trim().length === 0}
            onClick={send}
          >
            {props.running ? (
              <>
                <Spinner /> Answering
              </>
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </Container>
    </div>
  );
}
