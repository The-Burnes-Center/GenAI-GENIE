import type { ReactNode } from 'react'
import { OverlayArrow, Tooltip as AriaTooltip, TooltipTrigger, type TooltipTriggerComponentProps } from 'react-aria-components'

const TOOLTIP_DELAY_MS = 500

interface TooltipProps extends Omit<TooltipTriggerComponentProps, 'children'> {
  // The focusable trigger element. A tooltip is never the only carrier of a label.
  children: ReactNode
  text: string
}

export function Tooltip({ children, text, delay = TOOLTIP_DELAY_MS, ...rest }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay} closeDelay={0} {...rest}>
      {children}
      <AriaTooltip
        offset={6}
        className="ui-popover rounded-sm bg-ink px-2 py-1 text-caption text-canvas shadow-pop"
      >
        <OverlayArrow className="hidden" />
        {text}
      </AriaTooltip>
    </TooltipTrigger>
  )
}
