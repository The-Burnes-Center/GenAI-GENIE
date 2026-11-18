import { Article, CalendarBlank, Envelope, ListChecks, Question, Scales, TextAa, Translate } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { StarterIcon as StarterIconName } from '../../chat/starter-tasks'

const ICONS: Record<StarterIconName, Icon> = {
  summarize: Article,
  plain: TextAa,
  reply: Envelope,
  agenda: CalendarBlank,
  policy: Scales,
  translate: Translate,
  actions: ListChecks,
  faq: Question,
}

// A starter task's icon on a warm tile. The tile and icon are decoration, the title carries the meaning.
export function StarterIcon({ name }: { name: StarterIconName }) {
  const Glyph = ICONS[name]
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-warm-soft text-warm">
      <Glyph size={22} />
    </span>
  )
}
