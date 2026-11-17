# UI components

Import from `src/components/ui` (index.ts). Built on React Aria Components, Tailwind 4 tokens from `src/styles/tokens.css`. All have visible focus (2 px ring), reduced-motion support and 44 px targets on coarse pointers. Use `data-[...]` state variants for RAC state, never hand-rolled focus code.

| Component | Props and notes |
|---|---|
| `Button` | `variant` primary/secondary/ghost/danger/link, `size` md/sm, `isPending` + `pendingLabel` (spinner, width kept), `onPress`, `isDisabled`, RAC Button props |
| `IconButton` | `label` (required aria-label), `variant` (ghost), `size` |
| `LinkButton` | RAC Link styled as a button: `href`, `variant`, `size` |
| `buttonClass(variant,size,isIcon?)` | class string for custom elements |
| `TextField` | `label`, `description`, `errorMessage`, `multiline`, `rows`, `placeholder`, `maxLength`, `inputMode`, `inputRef`, plus RAC TextField props (`value`, `onChange`, `type`, `autoComplete`, `isRequired`) |
| `PasswordField` | TextField with Show/Hide toggle (`aria-pressed`) |
| `SearchField` | `label` (visually hidden), `placeholder`, `value`, `onChange`, clear button |
| `Checkbox` | children = label, `isSelected`, `onChange` |
| `Switch` | children = label, `isLabelHidden` (for tables), `isSelected`, `onChange` |
| `RadioGroup` | `label`, `options [{value,label,description}]`, `variant` cards/segmented, `value`, `onChange` |
| `Select` | `label`, `options [{id,label,description,isDisabled}]`, `selectedKey`, `onSelectionChange`, `isLabelHidden`, `errorMessage` |
| `ComboBox` | same options as Select, filtered text input |
| `Menu`, `MenuTrigger`, `MenuItem`, `MenuDivider`, `MenuHeading`, `MenuSection` | `MenuItem` takes `id`, `icon`, `isDanger`, `shortcut`; `Menu` takes `onAction`, `placement`, `aria-label` |
| `Popover` | RAC Popover surface; bottom sheet under 640 px |
| `Dialog`, `DialogFooter`, `DialogTrigger` | `title`, `isOpen`, `onOpenChange`, `isWide`; children may be `(close) => ReactNode` |
| `AlertDialog` | `title`, `body`, `confirmLabel`, `onConfirm`, `isOpen`, `onOpenChange`; focus starts on Cancel |
| `Tooltip` | wrap one focusable child: `<Tooltip text="..."><IconButton/></Tooltip>` (500 ms delay) |
| `Tabs` | `tabs [{id,label,content}]`, `ariaLabel`, `selectedKey`, `onSelectionChange` |
| `Badge`, `StatusChip` | `Badge tone icon`; `StatusChip status` ready/indexing/waiting/failed/suspended/active/pending (icon + words) |
| `InlineNotice` | `tone` info/ok/warn/bad (bad = role alert), `actions` |
| `ToastHost`, `toast` | mount `ToastHost` once (RootLayout does); `toast.show(msg,{actionLabel,onAction})`, `toast.error(msg)` persists |
| `Skeleton`, `SkeletonLines` | `SkeletonLines count label` has role status |
| `Spinner` | `size`, `label` |
| `EmptyState` | `icon`, `title`, `action`, `headingLevel`, children = text |
| `Table`, `CellText` | `columns [{id,header,cell,width,align,isActions,isPrimary}]`, `rows`, `getRowId`, `ariaLabel`, `empty`; stacks to labeled rows under 640 px |
| `InfiniteList`, `LoadMore` | `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`, `root`; observer plus a Load more button |
| `useMediaQuery`, `DESKTOP_QUERY`, `cx` | helpers |

Shell helpers: `layout/topbar-context.ts` `useTopbar(title, meta?)` sets the topbar and document title; `layout/PageFrame.tsx` is the standard page container; add `data-route-focus` to the element that should receive focus on route change (composer). Logo: `components/brand/Logo.tsx` (`Mark`, `Logo`) only.
