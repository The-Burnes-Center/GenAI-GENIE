import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useBootstrap } from '../../api/bootstrap'
import { RoomIllustration } from '../../components/brand/RoomIllustration'
import { PageStatus } from '../../components/chat/PageStatus'
import { ErrorText, LoadingText } from '../../components/chat/StatusText'
import { useTopbar } from '../../layout/topbar-context'
import { ChoosingModel, HowItWorks, HowToAsk, KeepLearning, NeedHelp, Tools, TryThese, WhatNotToShare, WhenToCheck } from './LearnSections'

// A short page for people who have never used AI. Sections have anchors, so other screens can link to one.
export function LearnPage() {
  useTopbar('Learn')
  const bootstrap = useBootstrap()
  const { hash } = useLocation()
  const isReady = bootstrap.isSuccess

  // /learn#share scrolls to the section and moves focus to its heading.
  useEffect(() => {
    if (!isReady || !hash) return
    const heading = document.getElementById(`${hash.slice(1)}-heading`)
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }, [isReady, hash])

  if (bootstrap.isPending) return <PageStatus><LoadingText /></PageStatus>
  if (bootstrap.isError) return <PageStatus><ErrorText error={bootstrap.error} /></PageStatus>
  const { settings, models } = bootstrap.data
  const defaultLabel = models.find((model) => model.modelId === settings.defaultModelId)?.label

  return (
    <div className="mx-auto grid max-w-[720px] gap-7 px-4 pb-16 pt-4 md:px-8 md:pb-20 md:pt-6">
      <header className="animate-rise flex items-center gap-4">
        <RoomIllustration size={88} isBusy className="hidden shrink-0 min-[480px]:block" />
        <div>
          <h1 tabIndex={-1} className="text-h1 font-semibold">Learn the basics</h1>
          <p className="mt-1 text-body text-ink-2">Five minutes to feel comfortable with {settings.appName}. You do not need to know anything about AI.</p>
        </div>
      </header>
      <HowItWorks />
      <HowToAsk />
      <Tools />
      <ChoosingModel defaultLabel={defaultLabel} />
      <WhenToCheck />
      <WhatNotToShare rules={settings.dataRules} />
      <TryThese />
      <KeepLearning links={settings.learnLinks} />
      <NeedHelp contact={settings.helpContact} />
    </div>
  )
}
