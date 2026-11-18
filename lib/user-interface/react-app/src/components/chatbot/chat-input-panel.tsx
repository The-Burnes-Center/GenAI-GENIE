import {
  Box,
  Button,
  Container,
  Select,
  SelectProps,
  Spinner,
  StatusIndicator,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import TextareaAutosize from "react-textarea-autosize";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { getChatModelOptions, SMART_MODEL_NAME } from "../../common/helpers/model-options";
import { StorageHelper } from "../../common/helpers/storage-helper";
import { API } from "aws-amplify";
import { GraphQLSubscription, GraphQLResult } from "@aws-amplify/api";
import { Model, ReceiveMessagesSubscription, Workspace } from "../../API";
import { LoadingStatus, ModelInterface } from "../../common/types";
import composer from "../../styles/composer.module.scss";
import ConfigDialog from "./config-dialog";
import { useAttachFiles } from "./use-attach-files";
import { isDocumentFile } from "./documents";
import { DropOverlay, FileChip, FileChipList } from "./file-chip";
import {
  ChabotInputModality,
  ChatBotHeartbeatRequest,
  ChatBotAction,
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotMode,
  ChatBotRunRequest,
  ChatInputState,
  ImageFile,
  ChatBotModelInterface,
} from "./types";
import { sendQuery } from "../../graphql/mutations";
import {
  getSelectedModelMetadata,
  getSignedUrl,
  updateMessageHistoryRef,
} from "./utils";
import { receiveMessages } from "../../graphql/subscriptions";
import { Utils } from "../../common/utils";
import { TaskOptions } from "../../common/constants";
import {SessionRefreshContext} from "../../common/session-refresh-context"
import { Auth } from "aws-amplify";
export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
  // A starter prompt chosen on the empty chat screen; `id` changes on every pick
  draft?: { text: string; id: number };
}
export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}
const workspaceDefaultOptions: SelectProps.Option[] = [
  {
    label: "Basic Chat [No Workspace]", //"No workspace (RAG data source)",
    value: "",
    iconName: "close",
  },
  {
    label: "Create new workspace",
    value: "__create__",
    iconName: "add-plus",
  },
];
export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const {needsRefresh, setNeedsRefresh} = useContext(SessionRefreshContext);
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    taskName: null,
    // Empty so the placeholder shows on a new chat
    value: "",
    selectedModel: null,
    selectedModelMetadata: null,
    selectedWorkspace: workspaceDefaultOptions[0],
    modelsStatus: "loading",
    workspacesStatus: "loading",
  });
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  const attach = useAttachFiles(props.configuration, props.setConfiguration);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!props.draft) return;
    setState((state) => ({ ...state, value: props.draft!.text }));
    textareaRef.current?.focus();
  }, [props.draft?.id]);
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.UNINSTANTIATED
  );
  const firstTimeRef = useRef<boolean>(false);
  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);
 // SARAH workspaces
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [globalError, setGlobalError] = useState<string | undefined>(undefined);

 useEffect(() => {
   if (!appContext) return;
   (async () => {
     const apiClient = new ApiClient(appContext);
     let workspaces: Workspace[] = [];
     let workspacesStatus: LoadingStatus = "finished";
     let modelsResult: GraphQLResult<any>;
     let workspacesResult: GraphQLResult<any>;
     try {
       let username = "";
       username = await Auth.currentAuthenticatedUser().then((value) => username = value.username);
       if (appContext?.config.rag_enabled) {
         [modelsResult, workspacesResult] = await Promise.all([
           apiClient.models.getModels(),
           apiClient.workspaces.getWorkspaces(username),
         ]);
         workspaces = workspacesResult.data?.listWorkspaces;
         workspacesStatus =
           workspacesResult.errors === undefined ? "finished" : "error";
       } else {
         modelsResult = await apiClient.models.getModels();
       }
       const models = modelsResult.data ? modelsResult.data.listModels : [];
       // The model picker's default is chosen by the effect below (getSelectedModelOption).
       // Setting selectedModel here too raced it and could leave the picker blank.
       setState((prevState) => ({
         ...prevState,
         models,
         workspaces,
         workspacesStatus,
       }));
     } catch (error) {
       console.error('Error fetching models or workspaces:', error);
       setError('An error occurred while fetching models or workspaces.');
     } finally {
       setLoading(false);
     }
   })();
 }, [appContext]);
// setting message history to the ref
  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;
  }, [props.messageHistory]);
  
  // starting appsync and retrieving message hisotry 
  useEffect(() => {
    async function subscribe() {
      console.log("Subscribing to AppSync");
      setReadyState(ReadyState.CONNECTING);
      const sub = await API.graphql<
        GraphQLSubscription<ReceiveMessagesSubscription>
      >({
        query: receiveMessages,
        variables: {
          sessionId: props.session.id,
        },
        authMode: "AMAZON_COGNITO_USER_POOLS",
      }).subscribe({
        next: ({ value }) => {
          const data = value.data!.receiveMessages?.data;
          if (data !== undefined && data !== null) {
            const response: ChatBotMessageResponse = JSON.parse(data);
            console.log("message data", response.data);
            if (response.action === ChatBotAction.Heartbeat) {
              console.log("Heartbeat pong!");
              return;
            }
            console.log("Session ID:", props.session.id);
            console.log("Message History Ref Current:", messageHistoryRef.current);
            console.log("Response:", response);
            updateMessageHistoryRef(
              props.session.id,
              messageHistoryRef.current,
              response
            );

            console.log

            if (
              response.action === ChatBotAction.FinalResponse ||
              response.action === ChatBotAction.Error
            ) {
              console.log("Final message received");
              props.setRunning(false);
              if (firstTimeRef.current) {
                Utils.delay(1500).then(() => setNeedsRefresh(true));
              }
            }
            props.setMessageHistory([...messageHistoryRef.current]);
          }
        },
        error: (error) => console.warn(error),
      });
      return sub;
    }

    const sub = subscribe();
    sub
      .then(() => {
        setReadyState(ReadyState.OPEN);
        console.log(`Subscribed to session ${props.session.id}`);
        const request: ChatBotHeartbeatRequest = {
          action: ChatBotAction.Heartbeat,
          modelInterface: ChatBotModelInterface.Langchain,
          data: {
            sessionId: props.session.id,
            // initialPrompt: props.initialPrompt
          },
        };
        const result = API.graphql({
          query: sendQuery,
          variables: {
            data: JSON.stringify(request),
          },
        });
        Promise.all([result])
          .then((x) => console.log(`Query successful`, x))
          .catch((err) => console.log(err));
      })
      .catch((err) => {
        console.log(err);
        setReadyState(ReadyState.CLOSED);
      });

    return () => {
      sub
        .then((s) => {
          console.log(`Unsubscribing from ${props.session.id}`);
          s.unsubscribe();
        })
        .catch((err) => console.log(err));
    };
    // eslint-disable-next-line
  }, [props.session.id]);
  
  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);
  // useEffect(() => {
  //   if (props.initialPrompt) {
  //     console.log("got to prompts use affect")
  //     setState((prevState) => ({ ...prevState, value: props.initialPrompt + " " }));
  //   }
  // }, [props.initialPrompt]);


  useEffect(() => {
    if (!appContext) return;
    (async () => {
      const apiClient = new ApiClient(appContext);
      let workspaces: Workspace[] = [];
      let workspacesStatus: LoadingStatus = "finished";
      let modelsResult: GraphQLResult<any>;
      let workspacesResult: GraphQLResult<any>;
      try {
         let username = "";
         username = await Auth.currentAuthenticatedUser().then((value) => username = value.username);
        if (appContext?.config.rag_enabled) {
          [modelsResult, workspacesResult] = await Promise.all([
            apiClient.models.getModels(),
            apiClient.workspaces.getWorkspaces(username),
          ]);
          workspaces = workspacesResult.data?.listWorkspaces;
          workspacesStatus =
            workspacesResult.errors === undefined ? "finished" : "error";
        } else {
          modelsResult = await apiClient.models.getModels();
        }
        const models = modelsResult.data ? modelsResult.data.listModels : [];
        
        // save meta model data to local storage as default
        let defaultModel = '';
        if(models.length){
          const smartModel = models.find((m) => m.name === "Smart Model");
          if (smartModel)  {
            defaultModel = "bedrock::Smart Model";
          }
        }

        const selectedModelOption = getSelectedModelOption(models, defaultModel);
        const selectedModelMetadata = getSelectedModelMetadata(
          models,
          selectedModelOption
        );

        const selectedWorkspaceOption = appContext?.config.rag_enabled
          ? getSelectedWorkspaceOption(workspaces)
          : workspaceDefaultOptions[0];
        setState((state) => ({
          ...state,
          models,
          workspaces,
          selectedModel: selectedModelOption,
          selectedModelMetadata,
          selectedWorkspace: selectedWorkspaceOption,
          modelsStatus: "finished",
          workspacesStatus: workspacesStatus,
        }));

      } catch (error) {
        console.log(Utils.getErrorMessage(error));
        setState((state) => ({
          ...state,
          modelsStatus: "error",
        }));

      }
    })();
  }, [appContext, state.modelsStatus]);

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
  
  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }
    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  useEffect(() => {
    const getSignedUrls = async () => {
      if (props.configuration?.files as ImageFile[]) {
        const files: ImageFile[] = [];
        for await (const file of props.configuration?.files ?? []) {
          const signedUrl = await getSignedUrl(file.key);
          files.push({
            ...file,
            url: signedUrl,
          });
        }
        setFiles(files);
      }
    };

    if (props.configuration.files?.length) {
      getSignedUrls();
    } else {
      setFiles([]);
    }
  }, [props.configuration]);

  // Earlier files stay in context for follow-up questions, whatever their type
  const hasFilesInChatHistory = function (): boolean {
    return (
      messageHistoryRef.current.filter(
        (x) =>
          x.type == ChatBotMessageType.Human &&
          x.metadata?.files &&
          (x.metadata.files as object[]).length > 0
      ).length > 0
    );
  };

  const handleSendMessage = () => {
    if (!state.selectedModel) return;
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;
    const { name, provider } = OptionsHelper.parseValue(
      state.selectedModel.value
    );
    let dateTime = new Date();
    let value = state.value 
    //+ " For more context current date and time is: " + dateTime.toLocaleString();
    
    value = value.trim()
    if (!value) return;
    
    const request: ChatBotRunRequest = {
      action: ChatBotAction.Run,
      modelInterface:
        (props.configuration.files && props.configuration.files.length > 0) ||
        hasFilesInChatHistory()
          ? "multimodal"
          : (state.selectedModelMetadata!.interface as ModelInterface),
      data: {
        mode: ChatBotMode.Chain,
        text: value,
        files: props.configuration.files ?? [],
        modelName: name,
        modelId: state?.models?.find((obj: any) => obj.name === name)?.modelId || null,
        provider: provider,
        sessionId: props.session.id,
        workspaceId: state.selectedWorkspace?.value,
        modelKwargs: {
          streaming: props.configuration.streaming,
          maxTokens: props.configuration.maxTokens,
          temperature: props.configuration.temperature,
          topP: props.configuration.topP,
        },
      },
    };

    //adding prompt to state 
    console.log(request);
    setState((state) => ({
      ...state,
      value: "",
    }));

    setFiles([]);
    props.setConfiguration({
      ...props.configuration,
      files: [],
    });

    console.log('chat-input state', state)
    props.setRunning(true);
    messageHistoryRef.current = [
      ...messageHistoryRef.current,
      {
        type: ChatBotMessageType.Human,
        content: value, 
        //  props.initialPrompt +
        metadata: {
          ...props.configuration,
        },
        tokens: [],
      }, 
      {
        type: ChatBotMessageType.AI,
        tokens: [],
        content: "",
        metadata: {},
      },
    ];

    props.setMessageHistory(messageHistoryRef.current);
    console.log('chat-input-panel.tsx', messageHistoryRef.current);
    firstTimeRef.current = false;
    if (messageHistoryRef.current.length < 3) {
      firstTimeRef.current = true;
    }
    API.graphql({
      query: sendQuery,
      variables: {
        data: JSON.stringify(request),
      },
    });
    // change here to set readonly to false after sending 
  //   if (isReadOnly) {
  //     setIsReadOnly(false);  // Allow editing after the first send
  //  }
  };
  

  const attachedFiles = props.configuration.files ?? [];
  const hasDocuments = attachedFiles.some(isDocumentFile);
  const hasImages = attachedFiles.some((file) => !isDocumentFile(file));
  const modalities = state.selectedModelMetadata?.inputModalities ?? [];
  // Files go to Claude Haiku 5.5 when the selected model cannot read them
  const unreadable = [
    hasDocuments && !modalities.includes(ChabotInputModality.Document) ? "documents" : null,
    hasImages && !modalities.includes(ChabotInputModality.Image) ? "images" : null,
  ].filter(Boolean);
  const isSmartModel = state.selectedModelMetadata?.name === SMART_MODEL_NAME;
  const isConnected = readyState === ReadyState.OPEN;

  const removeFile = (fileKey: string) => {
    props.setConfiguration((previous) => ({
      ...previous,
      files: (previous.files ?? []).filter((file) => file.key !== fileKey),
    }));
  };

  // Signed preview URLs for attached images (filled in by the effect that watches configuration.files)
  const previewUrl = (key: string) => files.find((f) => f.key === key)?.url || undefined;

  const modelsOptions = getChatModelOptions(state.models ?? []);

  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(state.workspaces ?? []),
  ];

  const canSend =
    isConnected &&
    !!state.models?.length &&
    !!state.selectedModel &&
    !props.running &&
    state.value.trim().length > 0 &&
    !props.session.loading;

  return (
    <div className={composer.composer}>
      <Container>
        {(attachedFiles.length > 0 || attach.pending.length > 0) && (
          <div className={composer.attachments}>
            <FileChipList label="Attached files">
              {[
                ...attachedFiles.map((file) => {
                  const name = file.name ?? (isDocumentFile(file) ? "Document" : "Image");
                  return (
                    <FileChip
                      key={file.key}
                      name={name}
                      previewUrl={isDocumentFile(file) ? undefined : previewUrl(file.key)}
                      onRemove={() => removeFile(file.key)}
                    />
                  );
                }),
                ...attach.pending.map((item) => <FileChip key={item.id} name={item.name} pending />),
              ]}
            </FileChipList>
            {unreadable.length > 0 && !isSmartModel && (
              <div className={composer.fallback_note}>
                <Box variant="small" color="text-body-secondary">
                  This model can't read {unreadable.join(" or ")}, so Claude Haiku 5.5 will answer.
                </Box>
              </div>
            )}
          </div>
        )}

        <TextareaAutosize
          ref={textareaRef}
          className={composer.textarea}
          aria-label="Message"
          value={state.value}
          minRows={2}
          maxRows={8}
          spellCheck={true}
          autoFocus
          onChange={(e) =>
            setState((state) => ({ ...state, value: e.target.value }))
          }
          onPaste={attach.onPaste}
          onKeyDown={(e) => {
            if (e.key == "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) handleSendMessage();
            }
          }}
          placeholder={
            listening
              ? "Listening..."
              : "Ask GENIE anything, or attach a document to ask about it"
          }
        />

        {attach.error && (
          <div className={composer.fallback_note} role="alert">
            <StatusIndicator type="error">{attach.error}</StatusIndicator>
          </div>
        )}

        <div className={composer.toolbar}>
          <div className={composer.toolbar_group}>
            <Button
              iconName="add-plus"
              onClick={attach.openPicker}
              loading={attach.uploading}
              disabled={props.running}
            >
              Attach
            </Button>
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

          <div className={`${composer.toolbar_group} ${composer.toolbar_end}`}>
            <div className={composer.model_select}>
              <Select
                ariaLabel="Model"
                disabled={props.running}
                statusType={state.modelsStatus}
                loadingText="Loading models..."
                placeholder="Choose a model"
                expandToViewport
                empty="No models are available right now."
                selectedOption={state.selectedModel}
                onChange={({ detail }) => {
                  setState((state) => ({
                    ...state,
                    selectedModel: detail.selectedOption,
                    selectedModelMetadata: getSelectedModelMetadata(
                      state.models,
                      detail.selectedOption
                    ),
                  }));
                  if (detail.selectedOption?.value) {
                    StorageHelper.setSelectedLLM(detail.selectedOption.value);
                  }
                }}
                options={modelsOptions}
              />
            </div>
            {appContext?.config.rag_enabled && (
              <div className={composer.model_select}>
                <Select
                  ariaLabel="Workspace"
                  disabled={
                    props.running || !state.selectedModelMetadata?.ragSupported
                  }
                  loadingText="Loading workspaces..."
                  statusType={state.workspacesStatus}
                  placeholder="Choose a workspace"
                  expandToViewport
                  selectedOption={state.selectedWorkspace}
                  options={workspaceOptions}
                  onChange={({ detail }) => {
                    if (detail.selectedOption?.value === "__create__") {
                      navigate("/rag/workspaces/create");
                    } else {
                      setState((state) => ({
                        ...state,
                        selectedWorkspace: detail.selectedOption,
                      }));
                      StorageHelper.setSelectedWorkspaceId(
                        detail.selectedOption?.value ?? ""
                      );
                    }
                  }}
                  empty={"No workspaces available"}
                />
              </div>
            )}
            <Button
              iconName="settings"
              variant="icon"
              ariaLabel="Chat settings"
              onClick={() => setConfigDialogVisible(true)}
            />
            <Button
              variant="primary"
              disabled={!canSend}
              onClick={handleSendMessage}
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
        </div>
      </Container>

      <div className={composer.footnote} aria-live="polite">
        {isConnected ? (
          <Box color="text-body-secondary">
            GENIE can make mistakes. Check important information, and don't enter sensitive data.
          </Box>
        ) : (
          <StatusIndicator
            type={
              readyState === ReadyState.CONNECTING ||
              readyState === ReadyState.UNINSTANTIATED
                ? "in-progress"
                : "error"
            }
          >
            {readyState === ReadyState.CONNECTING ||
            readyState === ReadyState.UNINSTANTIATED
              ? "Connecting..."
              : "Not connected. Refresh the page to try again."}
          </StatusIndicator>
        )}
      </div>

      {attach.fileInput}

      {attach.dragging && <DropOverlay />}
      <ConfigDialog
        sessionId={props.session.id}
        visible={configDialogVisible}
        setVisible={setConfigDialogVisible}
        configuration={props.configuration}
        setConfiguration={props.setConfiguration}
      />
    </div>
  );
}

function getSelectedWorkspaceOption(
  workspaces: Workspace[]
): SelectProps.Option | null {
  let selectedWorkspaceOption: SelectProps.Option | null = null;
  const savedWorkspaceId = StorageHelper.getSelectedWorkspaceId();
  if (savedWorkspaceId) {
    const targetWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);
    if (targetWorkspace) {
      selectedWorkspaceOption = OptionsHelper.getSelectOptions([
        targetWorkspace,
      ])[0];
    }
  }
  if (!selectedWorkspaceOption) {
    selectedWorkspaceOption = workspaceDefaultOptions[0];
  }
  return selectedWorkspaceOption;
}

function getSelectedModelOption(models: Model[], defaultModel:string = ''): SelectProps.Option | null {
  let selectedModelOption: SelectProps.Option | null = null;
  let savedModel = StorageHelper.getSelectedLLM();
  if(defaultModel){
    savedModel = defaultModel;
  }
  if (savedModel) {
    const savedModelDetails = OptionsHelper.parseValue(savedModel);
    const targetModel = models.find(
      (m) =>
        m.name === savedModelDetails.name &&
        m.provider === savedModelDetails.provider
    );
    if (targetModel) {
      selectedModelOption = OptionsHelper.getSelectOptionGroups([
        targetModel,
      ])[0].options[0];
    }
  }
  let candidate: Model | undefined = undefined;
  if (!selectedModelOption) {
    const bedrockModels = models.filter((m) => m.provider === "bedrock");
    const sageMakerModels = models.filter((m) => m.provider === "sagemaker");
    const openAIModels = models.filter((m) => m.provider === "openai");
    // Fallback when the Smart Model is unavailable: the low-cost Claude model
    candidate = bedrockModels.find((m) => m.name === "Claude Haiku 5.5");
    if (!candidate && sageMakerModels.length > 0) {
      candidate = sageMakerModels[0];
    }
    if (openAIModels.length > 0) {
      if (!candidate) {
        candidate = openAIModels.find((m) => m.name === "gpt-4");
      }
      if (!candidate) {
        candidate = openAIModels.find((m) => m.name === "gpt-3.5-turbo-16k");
      }
    }
    if (!candidate && bedrockModels.length > 0) {
      candidate = bedrockModels[0];
    }
    if (candidate) {
      selectedModelOption = OptionsHelper.getSelectOptionGroups([candidate])[0]
        .options[0];
    }
  }
  return selectedModelOption;
}