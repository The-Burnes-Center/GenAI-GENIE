import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowDown } from '@phosphor-icons/react'
import { useWorkspaceListItems } from '../../api/workspaces'
import type { AttachmentRef, Bootstrap, HintId, Rating, Template } from '../../api/types'
import { attachmentWarnings } from '../../chat/attach-rules'
import { chatHandoffs } from '../../chat/chat-handoffs'
import { hasFollowedUp, helperTarget } from '../../chat/answer-helpers'
import { TIP_COPY } from '../../chat/hints'
import { selectNextPlaceholder } from '../../chat/placeholders'
import { useRecentChats } from '../../chat/recent-chats'
import { resolveStarter, resolveStarterParam, STARTER_TASKS, type StarterTask } from '../../chat/starter-tasks'
import { useFeatureTip } from '../../chat/use-tip'
import { useHints } from '../../chat/use-hints'
import type { UiMessage } from '../../chat/messages'
import type { ChatEvent } from '../../chat/types'
import { useAnnouncer } from '../../chat/use-announcer'
import { useAttachments } from '../../chat/use-attachments'
import { useChatStream } from '../../chat/use-chat-stream'
import { useFileDrop } from '../../chat/use-file-drop'
import { useStickToBottom } from '../../chat/use-stick-to-bottom'
import { usageState } from '../../chat/usage'
import { AnswerHelpers } from '../../components/chat/AnswerHelpers'
import { FeatureTip } from '../../components/chat/FeatureTip'
import { LiveRegion } from '../../components/chat/LiveRegion'
import { MessageList } from '../../components/chat/MessageList'
import { UsageNotice } from '../../components/chat/UsageNotice'
import { Button, cx, toast } from '../../components/ui'
import { useIsOnline } from '../../layout/use-online-status'
import { useTopbar } from '../../layout/topbar-context'
import { ChatComposer } from './ChatComposer'
import { DropOverlay } from './DropOverlay'
import { HomeIntro, TemplateSuggestions } from './HomeIntro'
import { RecentChats } from './RecentChats'
import { LearnLine, StarterTasks } from './StarterTasks'
import { useWelcome } from './use-welcome'
import { WelcomeCard } from './WelcomeCard'

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

// New chat (hero) and saved chat in one component, so the composer keeps focus when the first message is sent.
export function ChatView({ bootstrap, sessionId: routeSessionId, title: savedTitle, initialModelId, initialWorkspaceId, initialMessages }: ChatViewProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings, models, templates, usage } = bootstrap
  // /home?template=<id> or /home?starter=<id> (the Learn page "Try it" links) pre-fill the box. Neither sends.
  const [fromParam] = useState(() => resolveStarterParam(searchParams.get('starter'), templates))
  const [templateId, setTemplateId] = useState<string | undefined>(
    findTemplate(templates, searchParams.get('template'))?.templateId ?? fromParam?.template?.templateId,
  )
  const template = findTemplate(templates, templateId)
  const [composerKey, setComposerKey] = useState(0)
  const [starterPrompt, setStarterPrompt] = useState(template?.starterPrompt ?? fromParam?.prompt ?? '')
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
  const hints = useHints()
  const recent = useRecentChats()

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
    if (starterPrompt && !routeSessionId && box) selectNextPlaceholder(box, 0)
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

  const helper = helperTarget(chat.messages, chat.isStreaming)
  const welcome = useWelcome({ hasMessages, startedFromLink: Boolean(fromParam) || searchParams.has('template') })
  const isWelcomeVisible = welcome.isVisible
  const homeTips: HintId[] = ['attach', ...(templates.length > 0 ? (['templates'] as const) : []), ...(workspaces.items.length > 0 ? (['workspaces'] as const) : []), 'compare']
  const chatTips: HintId[] = helper ? ['refine', ...(model?.capabilities.reasoning ? (['think-harder'] as const) : [])] : []
  const tip = useFeatureTip(hasMessages ? chatTips : homeTips, { isWelcomeVisible })
  const { markSeen } = hints

  // Two messages from the person means they already know it is a conversation.
  useEffect(() => {
    if (hasFollowedUp(chat.messages)) markSeen('refine')
  }, [chat.messages, markSeen])

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
    welcome.dismiss()
    welcome.release()
  }

  // The chips and the check button unmount when they send, so focus goes to the message box, which leaves the
  // reading position where it is.
  function handleFollowUp(prompt: string) {
    markSeen('refine')
    handleSend(prompt, [])
    textareaRef.current?.focus({ preventScroll: true })
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

  function fillComposer(prompt: string, nextTemplate?: Template) {
    setTemplateId(nextTemplate?.templateId)
    setStarterPrompt(prompt)
    setComposerKey((key) => key + 1)
    window.setTimeout(() => {
      const box = textareaRef.current
      if (box && !selectNextPlaceholder(box, 0)) box?.focus()
    }, 0)
  }

  function handleSuggestion(next: Template) {
    markSeen('templates')
    fillComposer(next.starterPrompt, next)
  }

  function handleStarter(task: StarterTask) {
    welcome.dismiss()
    const resolved = resolveStarter(task, templates)
    fillComposer(resolved.prompt, resolved.template)
  }

  function dismissWelcome() {
    welcome.dismiss()
    textareaRef.current?.focus()
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
      onWorkspaceChange={(id) => {
        markSeen('workspaces')
        setWorkspaceId(id)
      }}
      isThinkingDeep={isThinkingDeep}
      onThinkingChange={(isDeep) => {
        markSeen('think-harder')
        setIsThinkingDeep(isDeep)
      }}
      onToolUsed={markSeen}
      onDraftStart={welcome.onDraftStart}
      onDraftBlur={welcome.onDraftBlur}
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

  // Only a successful (empty) history proves someone is new. A failed load must not make them look new.
  const isNewcomer = welcome.shouldRender || (recent.isSuccess && recent.sessions.length === 0)
  const inlineTip = tip.tip && tip.tip !== 'refine' && tip.tip !== 'welcome' ? TIP_COPY[tip.tip] : null
  const helpers = helper ? (
    <AnswerHelpers
      text={helper.content}
      isDisabled={!isOnline || limit.isLimited}
      showTip={tip.tip === 'refine'}
      onDismissTip={tip.dismiss}
      onSend={handleFollowUp}
    />
  ) : null

  // The composer sits in the same tree position for the hero and the chat, so it keeps focus when the first message goes.
  return (
    <section
      aria-labelledby={hasMessages ? 'chat-heading' : 'home-title'}
      {...drop.dropProps}
      className={cx(
        'relative flex h-full min-h-0 flex-col',
        !hasMessages && 'overflow-y-auto px-4 pb-[6vh] pt-6 max-[479px]:pt-8',
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
                  lastTurnExtras={helpers}
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
      <div className={hasMessages ? 'min-w-0 flex-none px-4 pb-3.5 pt-2' : 'my-auto min-w-0'}>
        <div className="mx-auto grid w-full min-w-0 max-w-[var(--container-composer)] grid-cols-[minmax(0,1fr)] gap-2">
          {hasMessages ? false : <HomeIntro title={settings.welcomeTitle} message={template?.description || settings.welcomeMessage} isNewcomer={isNewcomer} />}
          {welcome.shouldRender && (
            <WelcomeCard
              appName={settings.appName}
              rules={settings.dataRules}
              isExiting={welcome.isExiting}
              onTryFirstTask={() => handleStarter(STARTER_TASKS[1])}
              onDismiss={dismissWelcome}
            />
          )}
          {hasMessages ? <UsageNotice usage={usage} /> : false}
          {inlineTip && (
            <FeatureTip title={inlineTip.title} link={inlineTip.link} onDismiss={tip.dismiss} className="mb-0.5">
              {inlineTip.body}
            </FeatureTip>
          )}
          {composer}
          {hasMessages ? false : isNewcomer ? (
            <StarterTasks onPick={handleStarter} showLearn={!welcome.shouldRender} />
          ) : (
            <>
              <TemplateSuggestions templates={templates} onPick={handleSuggestion} />
              <RecentChats sessions={recent.sessions} />
              <div className="mt-3"><LearnLine /></div>
            </>
          )}
          {settings.disclaimer && !helper && <p className="mt-0.5 text-center text-small text-ink-3">{settings.disclaimer}</p>}
          {hasMessages ? false : <UsageNotice usage={usage} />}
        </div>
      </div>
      <LiveRegion text={announcer.text} />
      {drop.isDragging && <DropOverlay />}
    </section>
  )
}
