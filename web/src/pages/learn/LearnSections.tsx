import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowSquareOut, EnvelopeSimple, ShieldWarning } from '@phosphor-icons/react'
import type { LearnLink } from '../../api/types'
import { CHECK_ITEMS, CHECK_STEPS, HABITS, HOW_IT_WORKS, TOOL_NOTES, helpLink, modelNote } from '../../chat/learn-content'
import { isHttpsUrl } from '../../chat/url-rules'
import { HOME_STARTER_COUNT, STARTER_TASKS } from '../../chat/starter-tasks'
import { StarterIcon } from '../../components/chat/StarterIcon'
import { buttonClass } from '../../components/ui'

export function LearnSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid scroll-mt-6 gap-3 border-t border-edge pt-7">
      <h2 id={`${id}-heading`} tabIndex={-1} className="text-h2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function HowItWorks() {
  return (
    <LearnSection id="how" title="How Genie works">
      <div className="grid max-w-[62ch] gap-2 text-body text-ink-2">
        {HOW_IT_WORKS.map((line) => <p key={line}>{line}</p>)}
      </div>
    </LearnSection>
  )
}

export function Tools() {
  return (
    <LearnSection id="tools" title="What the buttons do">
      <dl className="grid gap-2">
        {TOOL_NOTES.map((tool) => (
          <div key={tool.name} className="rounded-lg bg-sunken px-3.5 py-3">
            <dt className="font-semibold">{tool.name}</dt>
            <dd className="text-ink-2">{tool.body}</dd>
          </div>
        ))}
      </dl>
    </LearnSection>
  )
}

export function ChoosingModel({ defaultLabel }: { defaultLabel?: string }) {
  return (
    <LearnSection id="model" title="Choosing a model">
      <p className="max-w-[62ch] text-body text-ink-2">{modelNote(defaultLabel)}</p>
    </LearnSection>
  )
}

export function HowToAsk() {
  return (
    <LearnSection id="ask" title="How to ask">
      <p className="text-ink-2">Four habits get better answers. Each has an example to try. It opens a new chat with the example filled in. Nothing is sent until you press Send.</p>
      <ol className="grid list-none gap-2.5">
        {HABITS.map((habit, index) => (
          <li key={habit.id} className="flex items-start gap-3 rounded-lg border border-edge bg-surface p-3.5">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-warm-soft text-ui font-semibold text-warm-soft-ink">{index + 1}</span>
            <div className="grid min-w-0 flex-1 gap-1">
              <h3 className="font-semibold">{habit.title}</h3>
              <p className="text-ink-2">{habit.body}</p>
            </div>
            <Link to={`/home?starter=${habit.exampleId}`} aria-label={`Try it: ${habit.title}`} className={buttonClass('secondary', 'sm', false, 'shrink-0 pointer-coarse:min-h-11!')}>
              Try it
            </Link>
          </li>
        ))}
      </ol>
    </LearnSection>
  )
}

export function WhenToCheck() {
  return (
    <LearnSection id="check" title="When to double-check">
      <p className="max-w-[62ch] text-body text-ink-2">Genie can sound sure and still be wrong. Look closely at these before you send, sign or act on an answer.</p>
      <ul className="grid list-none gap-2 min-[560px]:grid-cols-2">
        {CHECK_ITEMS.map((item) => (
          <li key={item.title} className="rounded-lg bg-sunken px-3.5 py-3">
            <p className="font-semibold">{item.title}</p>
            <p className="text-ink-2">{item.body}</p>
          </li>
        ))}
      </ul>
      <h3 className="mt-1 font-semibold">How to check</h3>
      <ol className="grid list-decimal gap-1.5 pl-5 text-ink-2">
        {CHECK_STEPS.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </LearnSection>
  )
}

export function WhatNotToShare({ rules }: { rules: string[] }) {
  if (rules.length === 0) return null
  return (
    <LearnSection id="share" title="What not to share">
      <p className="text-ink-2">Leave these out of your messages and files.</p>
      <ul className="grid list-none gap-2">
        {rules.map((rule, index) => (
          <li key={index} className="flex items-start gap-3 rounded-lg border border-warm-edge bg-warm-soft px-3.5 py-3">
            <ShieldWarning size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-warm" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </LearnSection>
  )
}

export function TryThese() {
  const tasks = STARTER_TASKS.slice(0, HOME_STARTER_COUNT + 2)
  return (
    <LearnSection id="try" title="Try these">
      <p className="text-ink-2">Everyday jobs Genie does well. Pick one to open it in a new chat.</p>
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-2.5">
        {tasks.map((task) => (
          <li key={task.id} className="grid">
            <Link
              to={`/home?starter=${task.id}`}
              className="flex items-start gap-3 rounded-lg border border-edge-strong bg-surface p-3 text-ink no-underline transition-colors duration-[var(--duration-fast)] hover:bg-hover hover:text-ink"
            >
              <StarterIcon name={task.icon} />
              <span className="grid min-w-0 gap-0.5">
                <span className="font-semibold">{task.title}</span>
                <span className="text-small text-ink-2">{task.line}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </LearnSection>
  )
}

// Only https links are drawn, whatever is stored.
export function KeepLearning({ links: allLinks }: { links: LearnLink[] }) {
  const links = allLinks.filter((link) => isHttpsUrl(link.url))
  if (links.length === 0) return null
  return (
    <LearnSection id="learn" title="Keep learning">
      <ul className="grid list-none gap-2">
        {links.map((link, index) => (
          <li key={index}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-lg border border-edge-strong bg-surface p-3.5 text-ink no-underline hover:bg-hover hover:text-ink">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-semibold text-accent underline underline-offset-4">{link.title}<span className="vh"> (opens in a new tab)</span></span>
                {link.description && <span className="text-ink-2">{link.description}</span>}
                <span className="text-small text-ink-3">Opens in a new tab</span>
              </div>
              <ArrowSquareOut size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
            </a>
          </li>
        ))}
      </ul>
    </LearnSection>
  )
}

export function NeedHelp({ contact }: { contact: string }) {
  const link = helpLink(contact)
  if (!link) return null
  return (
    <LearnSection id="help" title="Need help?">
      <p className="text-ink-2">Stuck, or something looks wrong? Ask a person.</p>
      <p className="flex items-center gap-2">
        <EnvelopeSimple size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
        <a href={link.href} {...(link.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {link.label}
          {link.isExternal && <span className="vh"> (opens in a new tab)</span>}
        </a>
        {link.isExternal && <span className="text-small text-ink-3">Opens in a new tab</span>}
      </p>
    </LearnSection>
  )
}
