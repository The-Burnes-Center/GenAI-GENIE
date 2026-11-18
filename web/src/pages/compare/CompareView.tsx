import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForkSession } from '../../api/sessions'
import { describeError } from '../../api/errors'
import type { AttachmentRef, Bootstrap, Rating } from '../../api/types'
import { warningsForModels } from '../../chat/attach-rules'
import { compareHandoffs } from '../../chat/compare-handoffs'
import type { CompareTurn } from '../../chat/compare-state'
import { useAnnouncer } from '../../chat/use-announcer'
import { useFeatureTip, useMarkSeenOnVisit } from '../../chat/use-tip'
import { useAttachments } from '../../chat/use-attachments'
import { useCompare } from '../../chat/use-compare'
import { useFileDrop } from '../../chat/use-file-drop'
import { useStickToBottom } from '../../chat/use-stick-to-bottom'
import { usageState } from '../../chat/usage'
import { AnswerHelpers } from '../../components/chat/AnswerHelpers'
import { AttachMenu } from '../../components/chat/AttachMenu'
import { Composer } from '../../components/chat/Composer'
import { LiveRegion } from '../../components/chat/LiveRegion'
import { UsageNotice } from '../../components/chat/UsageNotice'
import { toast } from '../../components/ui'
import { useIsOnline } from '../../layout/use-online-status'
import { useTopbar } from '../../layout/topbar-context'
import { DropOverlay } from '../chat/DropOverlay'
import { CompareModels } from './CompareModels'
import { CompareTurns } from './CompareTurns'

interface CompareViewProps {
  bootstrap: Bootstrap
  sessionId?: string
  initialModelIds?: string[]
  initialTurns?: CompareTurn[]
}

const DEFAULT_COMPARE_COUNT = 2

export function CompareView({ bootstrap, sessionId, initialModelIds, initialTurns }: CompareViewProps) {
  const navigate = useNavigate()
  const { settings, models, usage } = bootstrap
  const [selected, setSelected] = useState<string[]>(initialModelIds ?? models.slice(0, DEFAULT_COMPARE_COUNT).map((model) => model.modelId))
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [settledId, setSettledId] = useState<string>()
  const [continuingId, setContinuingId] = useState<string>()
  const attachments = useAttachments()
  const announcer = useAnnouncer()
  const isOnline = useIsOnline()
  const fork = useForkSession()
  const scrollRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const limit = usageState(usage)
  const compare = useCompare({
    sessionId,
    initialTurns,
    onSettled: (id) => {
      setSettledId(id)
      announcer.announce('All answers are in.')
    },
  })
  const scroll = useStickToBottom(scrollRef, compare.turns)
  const drop = useFileDrop(attachments.add, compare.isStreaming || limit.isLimited)
  useTopbar('Compare models', `${selected.length} models`)
  useMarkSeenOnVisit('compare')
  const refineTip = useFeatureTip(['refine'], { isWelcomeVisible: false })
  // Follow-ups go to every model, once every answer in the last turn is in.
  const lastAnswers = compare.turns[compare.turns.length - 1]?.answers ?? []
  const finished = lastAnswers.filter((answer) => answer.status === 'complete' && answer.content.trim() !== '')
  const canFollowUp = !compare.isStreaming && finished.length > 0

  // Same hand-off as chat: the shell remounts the page when the path changes to /compare/:id.
  useEffect(() => {
    if (!settledId || sessionId) return
    compareHandoffs.stash(settledId, { turns: compare.turns, modelIds: selected })
    navigate(`/compare/${settledId}`, { replace: true })
  }, [settledId, sessionId, compare.turns, selected, navigate])
  useEffect(() => () => compareHandoffs.discard(sessionId), [sessionId])

  const chosen = models.filter((model) => selected.includes(model.modelId))
  const isLocked = sessionId !== undefined || compare.turns.length > 0
  const warnings = warningsForModels(attachments.items, chosen)
  const everyoneSeesImages = chosen.every((model) => model.capabilities.vision)
  const blindModel = chosen.find((model) => !model.capabilities.vision)

  function handleSend(prompt: string, files: AttachmentRef[]) {
    scroll.followNext()
    announcer.announce(`Sent to ${selected.length} models.`)
    void compare.send({ prompt, modelIds: selected, attachments: files })
  }

  const handleContinue = useCallback(
    (modelId: string) => {
      if (!compare.sessionId) return
      setContinuingId(modelId)
      fork.mutate(
        { id: compare.sessionId, input: { modelId } },
        {
          onSuccess: ({ sessionId: chatId }) => navigate(`/chat/${chatId}`),
          onError: (error) => toast.error(describeError(error)),
          onSettled: () => setContinuingId(undefined),
        },
      )
    },
    [compare.sessionId, fork, navigate],
  )

  return (
    <section aria-labelledby="compare-heading" {...drop.dropProps} className="relative flex h-full min-h-0 flex-col">
      <div ref={scrollRef} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-4 pb-6 pt-2 md:px-8">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3">
            <h1 id="compare-heading" className="text-h1 font-semibold leading-[var(--text-h1--line-height)]">Compare models</h1>
            <p className="-mt-2 text-ink-2">Send one message to up to {settings.maxCompareModels} models and read the answers side by side.</p>
            <CompareModels
              models={models}
              selected={selected}
              max={settings.maxCompareModels}
              defaultModelId={settings.defaultModelId}
              isLocked={isLocked}
              isPickerOpen={isPickerOpen}
              onPickerOpenChange={setIsPickerOpen}
              onChange={setSelected}
            />
            {isLocked && <p className="text-small text-ink-3">The models are fixed for this comparison. Start a new one to change them.</p>}
          </div>
          <CompareTurns
            turns={compare.turns}
            models={models}
            sessionId={compare.sessionId}
            dailyLimit={usage.limit}
            columns={selected.length}
            isStreaming={compare.isStreaming}
            continuingId={continuingId}
            onRetry={(turn, modelId) => void compare.retryColumn(turn, modelId, selected)}
            onContinue={handleContinue}
            onFeedback={(id: string, rating: Rating) => compare.setFeedback(id, rating)}
          />
          {canFollowUp && (
            <div className="mt-4 max-w-[var(--container-read)]">
              <AnswerHelpers
                scope="many"
                text={finished.map((answer) => answer.content).join('\n\n')}
                isDisabled={!isOnline || limit.isLimited || selected.length < 2}
                showTip={refineTip.tip === 'refine'}
                onDismissTip={refineTip.dismiss}
                onSend={(prompt) => {
                  refineTip.markSeen('refine')
                  handleSend(prompt, [])
                  // The buttons unmount when they send. Keep focus, and the reading position, with the box.
                  boxRef.current?.focus({ preventScroll: true })
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex-none px-4 pb-3.5 pt-2 md:px-8">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-2">
          <UsageNotice usage={usage} />
          <Composer
            inputId="compare-prompt"
            label="Message for all models"
            routeFocus
            textareaRef={boxRef}
            attachments={attachments}
            warnings={warnings}
            isStreaming={compare.isStreaming}
            closedReason={limit.isLimited ? 'You’ve reached today’s limit' : selected.length < 2 ? 'Choose at least two models' : undefined}
            isOffline={!isOnline}
            placeholder={`Ask all ${selected.length} models the same thing`}
            sendLabel="Send to all models"
            onSend={handleSend}
            onStop={() => {
              announcer.announce('Stopped.')
              compare.stop()
            }}
            tools={
              <AttachMenu
                canSeeImages={everyoneSeesImages}
                imageReason={blindModel ? `${blindModel.label} can't see images.` : ''}
                onFiles={attachments.add}
                isDisabled={compare.isStreaming}
              />
            }
            trailing={<span className="mr-1 text-small text-ink-2">Sent to {selected.length} models</span>}
          />
        </div>
      </div>
      <LiveRegion text={announcer.text} />
      {drop.isDragging && <DropOverlay />}
    </section>
  )
}
