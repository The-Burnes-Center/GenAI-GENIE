import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowDown } from '@phosphor-icons/react'
import { useWorkspaceListItems } from '../../api/workspaces'
import type { AttachmentRef, Bootstrap, Rating, Template } from '../../api/types'
import { attachmentWarnings } from '../../chat/attach-rules'
import { chatHandoffs } from '../../chat/chat-handoffs'
import type { UiMessage } from '../../chat/messages'
import type { ChatEvent } from '../../chat/types'
import { useAnnouncer } from '../../chat/use-announcer'
import { useAttachments } from '../../chat/use-attachments'
import { useChatStream } from '../../chat/use-chat-stream'
import { useFileDrop } from '../../chat/use-file-drop'
import { useStickToBottom } from '../../chat/use-stick-to-bottom'
import { usageState } from '../../chat/usage'
import { LiveRegion } from '../../components/chat/LiveRegion'
import { MessageList } from '../../components/chat/MessageList'
import { UsageNotice } from '../../components/chat/UsageNotice'
import { Button, cx, toast } from '../../components/ui'
import { useIsOnline } from '../../layout/use-online-status'
import { useTopbar } from '../../layout/topbar-context'
import { ChatComposer } from './ChatComposer'
import { DropOverlay } from './DropOverlay'
import { HomeIntro, TemplateSuggestions } from './HomeIntro'

interface ChatViewProps {
  bootstrap: Bootstrap
  sessionId?: string
  title?: string
  initialModelId?: string
  initialWorkspaceId?: string
  initialMessages?: UiMessage[]
}

function findTemplate(templates: Template[], id: string | null | undefined): Template | undefined {
  return id ? templates.find((template) => template.templateId === id) : undefined
}

// Selects the first [placeholder] in a starter prompt so typing replaces it, else puts the caret at the end.
function selectPlaceholder(box: HTMLTextAreaElement): void {
  const open = box.value.indexOf('[')
  const close = open >= 0 ? box.value.indexOf(']', open) : -1
  if (open >= 0 && close > open) box.setSelectionRange(open, close + 1)
  else box.setSelectionRange(box.value.length, box.value.length)
}

// New chat (hero) and saved chat in one component, so the composer keeps focus when the first message is sent.
export function ChatView({ bootstrap, sessionId: routeSessionId, title: savedTitle, initialModelId, initialWorkspaceId, initialMessages }: ChatViewProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings, models, templates, usage } = bootstrap
  const [templateId, setTemplateId] = useState<string | undefined>(findTemplate(templates, searchParams.get('template'))?.templateId)
  const template = findTemplate(templates, templateId)
  const [composerKey, setComposerKey] = useState(0)
  const [starterPrompt, setStarterPrompt] = useState(template?.starterPrompt ?? '')
  const [modelId, setModelId] = useState(initialModelId ?? settings.defaultModelId)
  const model = models.find((candidate) => candidate.modelId === modelId) ?? models.find((candidate) => candidate.modelId === settings.defaultModelId) ?? models[0]
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? searchParams.get('workspace') ?? '')
  const [isThinkingDeep, setIsThinkingDeep] = useState(false)
  const [title, setTitle] = useState(savedTitle)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [retryAfterPick, setRetryAfterPick] = useState<string | null>(null)
  const [settledId, setSettledId] = useState<string>()
  const workspaces = useWorkspaceListItems()
  const attachments = useAttachments()
  const isOnline = useIsOnline()
  const announcer = useAnnouncer()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const limit = usageState(usage)

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.type === 'session' && event.title) setTitle(event.title)
      if (event.type === 'title') {
        setTitle(event.title)
        announcer.announce(`Chat title: ${event.title}`)
      }
      if (event.type === 'done') announcer.announce('The response is complete.')
      if (event.type === 'error') announcer.announce('The response failed.')
    },
    [announcer],
  )
  const chat = useChatStream({ sessionId: routeSessionId, initialMessages, onEvent, onSettled: (id) => setSettledId(id) })
  const scroll = useStickToBottom(scrollRef, chat.messages)
  const drop = useFileDrop(attachments.add, chat.isStreaming || limit.isLimited)

  const workspaceName = workspaces.items.find((workspace) => workspace.workspaceId === workspaceId)?.name
  const hasMessages = chat.messages.length > 0
  useTopbar(hasMessages ? (title ?? 'New chat') : '', hasMessages && model ? `${model.label}${workspaceName ? `, ${workspaceName}` : ''}` : undefined)

  // A chat made on /home moves to /chat/:id once it settles. The shell remounts the page then, so hand the messages over.
  useEffect(() => {
    if (!settledId || routeSessionId) return
    chatHandoffs.stash(settledId, { messages: chat.messages, modelId, workspaceId, title })
    navigate(`/chat/${settledId}`, { replace: true })
  }, [settledId, routeSessionId, chat.messages, modelId, workspaceId, title, navigate])
  useEffect(() => () => chatHandoffs.discard(routeSessionId), [routeSessionId])

  useEffect(() => {
    const box = textareaRef.current
    if (template && !routeSessionId && box) selectPlaceholder(box)
    // Runs on mount and when a suggestion remounts the composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerKey])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.code === 'KeyM') {
        event.preventDefault()
        setIsPickerOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!model) return <p role="alert" className="p-8">No models are enabled. Ask an administrator to enable one.</p>

  const context = {
    workspaceId: workspaceId || undefined,
    settings: model.capabilities.reasoning ? { thinking: isThinkingDeep ? ('deep' as const) : ('standard' as const) } : undefined,
  }

  function handleSend(prompt: string, files: AttachmentRef[]) {
    scroll.followNext()
    announcer.announce(`${model.label} is thinking`)
    void chat.send({ ...context, modelId: model.modelId, prompt, attachments: files, templateId: chat.sessionId ? undefined : templateId })
    setTemplateId(undefined)
  }

  function handleModelChange(nextId: string, reason?: 'switch') {
    const next = models.find((candidate) => candidate.modelId === nextId)
    if (!next) return
    setModelId(nextId)
    if (!next.capabilities.reasoning) setIsThinkingDeep(false)
    if (reason === 'switch') toast.show(`Switched to ${next.label}.`)
    if (retryAfterPick) {
      void chat.retry(retryAfterPick, { ...context, modelId: nextId })
      setRetryAfterPick(null)
    }
  }

  function handleRetry(assistantId: string) {
    scroll.followNext()
    announcer.announce(`${model.label} is thinking`)
    void chat.retry(assistantId, { ...context, modelId: model.modelId })
  }

  function handleSuggestion(next: Template) {
    setTemplateId(next.templateId)
    setStarterPrompt(next.starterPrompt)
    setComposerKey((key) => key + 1)
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const warnings = attachmentWarnings(attachments.items, model)
  const chips = [
    ...(template && !chat.sessionId ? [{ label: `Template: ${template.title}`, icon: 'template' as const, onRemove: () => setTemplateId(undefined) }] : []),
    ...(workspaceId ? [{ label: `Workspace: ${workspaceName ?? 'Selected'}`, icon: 'workspace' as const, onRemove: () => setWorkspaceId('') }] : []),
  ]
  const composer = (
    <ChatComposer
      key={composerKey}
      attachments={attachments}
      warnings={warnings}
      models={models}
      model={model}
      defaultModelId={settings.defaultModelId}
      onModelChange={handleModelChange}
      isModelPickerOpen={isPickerOpen}
      onModelPickerOpenChange={(open) => {
        setIsPickerOpen(open)
        if (!open) setRetryAfterPick(null)
      }}
      workspaces={workspaces.items}
      workspaceId={workspaceId}
      onWorkspaceChange={setWorkspaceId}
      isThinkingDeep={isThinkingDeep}
      onThinkingChange={setIsThinkingDeep}
      isStreaming={chat.isStreaming}
      closedReason={limit.isLimited ? 'You’ve reached today’s limit' : undefined}
      isOffline={!isOnline}
      initialPrompt={starterPrompt}
      contextChips={chips}
      onSend={handleSend}
      onStop={() => {
        announcer.announce('Stopped.')
        chat.stop()
      }}
      textareaRef={textareaRef}
    />
  )

  // The composer sits in the same tree position for the hero and the chat, so it keeps focus when the first message goes.
  return (
    <section
      aria-labelledby={hasMessages ? 'chat-heading' : 'home-title'}
      {...drop.dropProps}
      className={cx(
        'relative flex h-full min-h-0 flex-col',
        !hasMessages && 'justify-center overflow-y-auto px-4 pb-[10vh] pt-6 max-[479px]:justify-start max-[479px]:pt-8',
      )}
    >
      {hasMessages && (
        <>
          <h1 id="chat-heading" className="vh">{title ?? 'New chat'}</h1>
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={scroll.onScroll} className="h-full overflow-y-auto">
              <div className="mx-auto max-w-[var(--container-read)] px-4 pb-6 pt-4">
                <MessageList
                  messages={chat.messages}
                  sessionId={chat.sessionId}
                  models={models}
                  dailyLimit={usage.limit}
                  isStreaming={chat.isStreaming}
                  onRetry={handleRetry}
                  onChooseModel={(id) => {
                    setRetryAfterPick(id)
                    setIsPickerOpen(true)
                  }}
                  onFeedback={(id, rating: Rating) => chat.setFeedback(id, rating)}
                />
              </div>
            </div>
            {!scroll.isAtBottom && (
              <Button size="sm" className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 shadow-pop" onPress={scroll.jumpToLatest}>
                <ArrowDown size={16} aria-hidden="true" />
                Jump to latest
              </Button>
            )}
          </div>
        </>
      )}
      <div className={hasMessages ? 'min-w-0 flex-none px-4 pb-3.5 pt-2' : 'min-w-0'}>
        <div className="mx-auto grid w-full min-w-0 max-w-[var(--container-composer)] grid-cols-[minmax(0,1fr)] gap-2">
          {hasMessages ? false : <HomeIntro title={settings.welcomeTitle} message={template?.description || settings.welcomeMessage} />}
          {hasMessages ? <UsageNotice usage={usage} /> : false}
          {composer}
          {hasMessages ? false : <TemplateSuggestions templates={templates} onPick={handleSuggestion} />}
          {settings.disclaimer && <p className="mt-0.5 text-center text-small text-ink-3">{settings.disclaimer}</p>}
          {hasMessages ? false : <UsageNotice usage={usage} />}
        </div>
      </div>
      <LiveRegion text={announcer.text} />
      {drop.isDragging && <DropOverlay />}
    </section>
  )
}
