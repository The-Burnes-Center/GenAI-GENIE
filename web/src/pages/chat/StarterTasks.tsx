import { Link } from 'react-router'
import { BookOpenText } from '@phosphor-icons/react'
import { HOME_STARTER_COUNT, STARTER_TASKS, type StarterTask } from '../../chat/starter-tasks'
import { StarterIcon } from '../../components/chat/StarterIcon'
import { buttonClass } from '../../components/ui'

interface StarterTasksProps {
  onPick: (task: StarterTask) => void
  // Off while the welcome card is up, since the card already links to Learn.
  showLearn: boolean
}

// About six broad jobs, each a card. Picking one fills the message box with an example to edit. It never sends.
export function StarterTasks({ onPick, showLearn }: StarterTasksProps) {
  return (
    <section aria-labelledby="starter-heading" className="animate-rise-late mt-5 grid gap-3">
      <h2 id="starter-heading" className="text-ui font-semibold text-ink-2">Or start with a task</h2>
      <ul className="grid list-none grid-cols-1 gap-2.5 min-[560px]:grid-cols-2 lg:grid-cols-3">
        {STARTER_TASKS.slice(0, HOME_STARTER_COUNT).map((task) => (
          <li key={task.id} className="grid">
            <button
              type="button"
              onClick={() => onPick(task)}
              className="group flex min-h-16 items-start gap-3 rounded-lg border border-edge-strong bg-surface p-3 text-left transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-hover active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <StarterIcon name={task.icon} />
              <span className="grid min-w-0 gap-0.5">
                <span className="font-semibold text-ink">{task.title}</span>
                <span className="text-small text-ink-2">{task.line}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {showLearn && (
        <Link to="/learn" className={buttonClass('secondary', 'md', false, 'justify-self-start')}>
          <BookOpenText size={20} aria-hidden="true" />
          New to AI? Learn the basics
        </Link>
      )}
    </section>
  )
}

// The quiet version for people who have used Genie before.
export function LearnLine() {
  return (
    <p className="text-small text-ink-3">
      New to AI?{' '}
      <Link to="/learn">Learn the basics</Link>
    </p>
  )
}
