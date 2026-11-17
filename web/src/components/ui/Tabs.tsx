import type { ReactNode } from 'react'
import { Tab as AriaTab, TabList, TabPanel, Tabs as AriaTabs, type TabsProps } from 'react-aria-components'
import { cx } from './cx'

export interface TabItem {
  id: string
  label: string
  content?: ReactNode
}

interface Props extends Omit<TabsProps, 'children' | 'className'> {
  tabs: TabItem[]
  ariaLabel: string
  className?: string
}

// Arrow keys, Home and End move between tabs. The list scrolls sideways on narrow screens.
export function Tabs({ tabs, ariaLabel, className, ...rest }: Props) {
  return (
    <AriaTabs {...rest} className={cx('grid gap-5', className)}>
      <TabList aria-label={ariaLabel} className="scroll-thin flex gap-1 overflow-x-auto border-b border-edge">
        {tabs.map((tab) => (
          <AriaTab
            key={tab.id}
            id={tab.id}
            className={
              '-mb-px min-h-10 cursor-pointer whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-medium text-ink-2 outline-none ' +
              'data-[hovered]:text-ink data-[selected]:border-accent data-[selected]:text-ink ' +
              'data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus pointer-coarse:min-h-11'
            }
          >
            {tab.label}
          </AriaTab>
        ))}
      </TabList>
      {tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} className="outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus">
          {tab.content}
        </TabPanel>
      ))}
    </AriaTabs>
  )
}
