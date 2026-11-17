# Genie design

Design spec for Genie v2. Pairs with `tokens.css` (Tailwind CSS 4 tokens), `logo.svg`, `mark.svg` and the clickable prototype in `prototype/`. Built on `ARCHITECTURE.md` (data model, REST API, streaming contract). Where a screen needs something the contract does not provide, it is listed under "Contract gaps" at the end rather than assumed.

Stack for the build: React 19, Tailwind CSS 4, React Aria Components (RAC), `@phosphor-icons/react`, Geist and Geist Mono.

## 1. Direction in one paragraph

Genie is a quiet reading-and-writing room, not a dashboard and not a robot. Content is the hero: one wide column of text, one composer, almost no chrome. Identity comes from type (Geist), a single deep teal accent, cool paper-gray surfaces, and generous spacing, not from gradients, glow or illustration. The mark is "Room": a rounded box with a slot in its left wall and a line of text passing through it, a calm room that words come into. No lamp, no sparkle, no letter.

## 2. Principles

1. **The page is the answer.** Answers get a 720 px reading column at 16/26 px, no bubbles, no avatars. Everything that is not the answer (actions, sources, model name, thinking) is smaller and quieter, and appears where the eye already is.
2. **One accent, spent rarely.** Teal appears on the primary button, the send button, links, the current item, focus and the single chart color. Status colors (red, amber, green) appear only with an icon and words, never alone.
3. **Say what happened, say what to do.** Every error names the cause in plain words and offers the next move as a button ("Try again", "Choose another model"). No codes, no "inference", no "tokens" outside the admin usage page.
4. **Explain limits before they bite.** If a model cannot see images, the attach menu, the model picker and the composer all say so before sending, with a one-click fix. Never fail silently and never drop an attachment without telling the person.
5. **Calm motion that earns its place.** Motion confirms an action (press, appear, stream) or shows continuity (drawer, popover origin). Nothing loops except the thinking spinner and the streaming caret, and both stop under reduced motion.
6. **Keyboard and phone first-class.** Every action has a keyboard path and a 44 px touch target on coarse pointers. The 360 px layout is a designed layout (popovers become bottom sheets, tables become stacked rows, compare columns stack), not a shrunk desktop.
7. **Plain language for non-experts, honest detail for admins.** Staff never see model ids, token counts or error codes. Admins see them in the console, in monospace, next to a plain-language label.

## 3. Information architecture and navigation

```
Sign in area (no sidebar)
  /signin            email, then passkey | password | email code
  /newpw             invited user sets password
  /forgot            email, code, new password
  /signup            create account, then code
  /pending           waiting for approval
  /suspended         account suspended

App shell (sidebar + topbar)
  /home              new chat (welcome, composer, template suggestions)
  /chat/:id          conversation
  /compare           2 to 3 models, one prompt
  /templates         gallery
  /workspaces        list
  /workspaces/:id    detail, documents, "Chat with this workspace"
  /history           search, rename, delete, delete all
  /account           passkeys, password, theme
  Admin (same shell, sidebar swaps to admin nav; hidden and 404 for non-admins)
  /admin/users       invite, approval queue, roles, suspend
  /admin/models      enable, default, test, rename, add
  /admin/templates   list; /admin/templates/:id and /new editor
  /admin/settings    welcome, models and limits, sign-up
  /admin/usage       totals, daily chart, by model, by person
  /admin/feedback    thumbs-down queue
  /admin/audit       admin actions
  404                "We can't find that page"
```

**Sidebar (chat mode):** logo and close, New chat (primary outline, `Alt N`), Compare, Templates, Workspaces, search field, history grouped Today / Yesterday / Previous 7 days / Older (newest 50, infinite scroll in the build), All chats, then the account button (opens a menu: Account and passkeys, theme, keyboard shortcuts, Admin console, Sign out).
**Sidebar (admin mode):** Back to Genie, then Users (with a "2 waiting" badge), Models, Templates, Settings, Usage, Feedback, Audit log.
**Topbar:** sidebar toggle and New chat (only when the sidebar is hidden), chat title with model and workspace in muted text. Nothing else. There is no per-chat settings button (temperature and length controls were removed; see section 9).
**Composer tools:** Attach, Workspace, Think harder (only on models that support it), model picker, send.

### Layout grid and breakpoints

| Breakpoint | Name | Behavior |
|---|---|---|
| 0 to 639 | phone | Sidebar is an off-canvas drawer (86 vw, max 320). Popovers become bottom sheets. Tables stack into labeled rows. Compare columns stack. Composer tool buttons are icon-only. 16 px gutters. |
| 640 to 1023 | tablet | Sidebar still a drawer. Popovers anchor normally. Composer tools show labels. |
| 1024+ | desktop | Sidebar docks at 280 px and can collapse (state remembered per browser). |
| 1280+ | wide | Content widths stop growing: conversation 720, composer 760, admin pages 1088, compare 1280. |

Spacing is a 4 px base. Page gutters are 16 px on phone, 32 px from 768. Vertical rhythm inside prose is 12 px between blocks, 22 px before a heading.

## 4. Typography

**Geist** for all UI and reading, **Geist Mono** for model ids, code and numbers in admin tables. Both are on Google Fonts (prototype) and as `@fontsource/geist` and `@fontsource/geist-mono` (production).

Why Geist: tall x-height and open apertures keep 14 px UI text and 16 px reading text legible, it has tabular figures for usage tables, its single-storey `g` and squared curves feel precise rather than friendly-bubbly, and it avoids the overused Inter look. It has a true weight range (400, 500, 600 are all we use), and it pairs with a matching mono. No serif is used: this is a tool, not a publication.

**Self-host in production** (`@fontsource`, `font-display: swap`, preload the 400 and 600 Latin files). For a public-sector product this also avoids sending staff IP addresses to a third party. The prototype uses the Google Fonts link for convenience only.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-display` | 32 / 38, tracking -0.02em | 600 | Home welcome title, 404, sign-in aside |
| `text-h1` | 24 / 30 | 600 | Page titles |
| `text-h2` | 20 / 26 | 600 | Dialog titles |
| `text-title` | 18 / 24 | 600 | Section titles, answer headings, welcome message |
| `text-body` | 16 / 26 | 400 | Answers, user messages, form inputs on phone |
| `text-ui` | 14 / 20 | 400, 500 | Buttons, tables, menus, inputs on desktop |
| `text-small` | 13 / 18 | 400, 500 | Helper text, meta, notices |
| `text-caption` | 12 / 16 | 500 | Badges, group labels, keyboard hints (never for essential content) |

Rules: inputs are 16 px on phones so iOS does not zoom. Line length for prose is capped by the 720 px column (about 70 characters). Numbers in tables use `font-variant-numeric: tabular-nums`. No all-caps labels except the two small "PREVIEW" tags in the admin editors.

## 5. Color

Neutral cool paper-gray surfaces with one deep teal accent (hue about 190). Not purple, not warm beige. Light and dark are designed as a pair: the same hierarchy, different values, and the accent is lighter (not desaturated) in dark.

### Tokens

Defined in `tokens.css` as `--color-*` inside Tailwind's `@theme` (so `bg-canvas`, `text-ink`, `border-edge`, `bg-accent` all work) with overrides under `.dark` and under `@media (prefers-color-scheme: dark)` guarded by `:root:not(.light)`. The theme toggle sets `dark` or `light` on `<html>`; "System" removes both.

| Token | Light | Dark | Role |
|---|---|---|---|
| `canvas` | #f6f8f8 | #0f1515 | App background |
| `surface` | #ffffff | #151d1d | Composer, tables, inputs, dialogs |
| `sunken` | #ecf0f0 | #0b1010 | Sidebar, user message, code block |
| `raised` | #ffffff | #1b2525 | Menus and popovers |
| `hover` / `selected` | #e4eaea / #dae7e9 | #1f2a2a / #243636 | Row hover, current item |
| `edge` | #dce3e3 | #263232 | Decorative dividers only |
| `edge-strong` | #76868a | #6b7d80 | Control borders, switch track (3:1) |
| `ink` / `ink-2` / `ink-3` | #121e1e / #3f4e4e / #566565 | #e8efef / #b8c4c4 / #94a3a3 | Text, secondary, muted and placeholder |
| `accent` | #0a6573 | #5cc5d4 | Primary actions, links, focus, chart |
| `accent-ink` | #ffffff | #04181c | Text on accent |
| `accent-soft` / `accent-soft-ink` | #e0f0f2 / #064650 | #11292e / #9be0ea | Badges, selected chips |
| `danger` / `danger-ink` | #b42318 / #fff | #f28b82 / #260805 | Destructive button, error text |
| `danger-soft` + ink | #fdecea / #8f1d14 | #3a1614 / #ffb4ab | Error blocks |
| `warn-soft` + ink | #fcf1d6 / #6e4700 | #33270a / #f5cf7a | Limit and warning banners |
| `ok-soft` + ink | #e1f2e6 / #17572f | #12301c / #8fdba6 | Ready and passed badges |
| `focus` | #0a6573 | #7ad3e0 | Focus ring (2 px, 2 px offset) |
| `code-*` | see tokens | see tokens | Code block and syntax colors |

Pure black and pure white are never used for text or page backgrounds. White appears only as the light-mode `surface`.

### Contrast (computed)

Every pair below was computed from `tokens.css` by a script (WCAG 2.2 relative luminance). Thresholds: 4.5:1 for text, 3:1 for UI component boundaries, focus indicators and chart marks. Result: **90 of 90 pairs pass (45 per theme)**, no failures. The lowest margins are the control border on the sidebar in light (3.30:1) and muted text on a selected row (4.82:1 light, 4.85:1 dark). The full table is in Appendix A.

Meaning is never carried by color alone: status badges and banners always include an icon and text ("Ready", "Failed", "Suspended"), and links are underlined in prose.

## 6. Spacing, radius, elevation

**Spacing:** Tailwind scale on a 4 px unit (`--spacing: 0.25rem`). Common values: 8 (icon gaps), 12 (control padding, block gap), 16 (gutter, card padding), 24 (section gap), 32 (page gutter on desktop).

**Radius (one rule):** controls 8 (`rounded-md`), containers 12 (`rounded-lg`: tables, banners, columns, menus), composer and dialogs 16 (`rounded-xl`), small tags 4 (`rounded-xs`), full only for avatars, the send button and switch. Buttons are not pills.

**Elevation:** flat by default. Borders do the separating. Three shadows, all tinted toward the teal-gray hue (never pure black on light):
`shadow-composer` (the composer only), `shadow-pop` (menus, popovers, toasts, passkey prompt), `shadow-dialog` (dialogs and the mobile drawer).

## 7. Icons

**`@phosphor-icons/react`** (MIT), regular weight at 20 px (16 px inside badges and chips), fill weight only for stop and pressed thumbs. Why: one coherent family on a 256 grid with six weights, tree-shakeable per icon, large coverage of the metaphors we need (fingerprint, brain, books, columns, sliders, paperclip, hourglass, wifi-slash), and its regular weight matches Geist's stroke contrast. Icons are decorative (`aria-hidden`) next to text, and carry an `aria-label` on the button when they stand alone.
The prototype inlines the same glyph paths from `@phosphor-icons/core` as an SVG sprite so it stays dependency-free. Nothing is hand-drawn except the mark and wordmark.

Mapping: New chat `plus`, Compare `columns`, Templates `file-text`, Workspaces `books`, History `clock-counter-clockwise`, Attach `paperclip`, Think harder `brain`, Passkey `fingerprint`, Waiting `hourglass`, Info notice `info`, Error `warning-circle`, Admin `shield-check`.

## 8. Identity

**Mark: "Room".** A rounded rectangle (the one calm place to read and write) with a slot in its left wall and a rounded line passing through it into the room (what you ask, and the answers and documents that come in). It is geometric, single color, and has no letter, ring, star or arc. Two cuts of one drawing, because detail that works at 128 px turns to mush at 16:

| File | Use | Notes |
|---|---|---|
| `mark.svg` | Master, 24 px and up | 7-unit frame, slot, one through-line and two short text lines |
| `favicon.svg` | 16 and 32 px, and the sidebar logo | 10-unit frame and one thick through-line so the slot and line stay distinct at 16 px |
| `logo.svg` | Lockups | Master mark plus outlined lowercase "genie" (Geist 600), no font dependency |
| `app-icon.svg` | 180 and 512 px app icons | White mark on a full-bleed teal (#0a6573) square; the OS applies its own corner mask |

Color: accent #0a6573 in light, #5cc5d4 in dark; the SVG files switch through an internal `prefers-color-scheme` rule, so inline the SVG with `currentColor` where the app theme must win over the OS. Minimum sizes: small cut 16 px, master 24 px, logo 72 px wide. Clear space: the height of one line (about a seventh of the mark).

**Why it is distinct.** At small sizes the first draft read as a lowercase "a", so the doorway became a slot in an otherwise closed box. It is unlike a terminal icon (no chevron or cursor), a toggle (no circle), the Google G and the other marks on the avoid list (no ring or arc, star, knot, burst, ribbon, loop or pixel blocks). The closest generic neighbor is a "sign in" or "import" icon, so never add an arrowhead. This is a design check, not trademark clearance. Comparison page: `prototype/marks.html`.

If an admin renames the app (`appName`), show the mark plus the name in Geist 600 instead of the wordmark.

## 9. Chat model (what changed in this scope)

- **No temperature or response-length controls.** Most current models reject temperature and the server always requests the model's full output limit. The old "Response style" button is gone.
- **Think harder** is a toggle in the composer (`aria-pressed`), rendered only when the selected model has `capabilities.reasoning`; it sends `settings.thinking: "deep"`, otherwise `"standard"`. Tooltip: "Slower, but better on tricky questions". Switching to a model without reasoning hides it and resets it.
- **Thinking section.** Before the first streamed word the answer area shows a spinner and "Thinking 12s" (or "Working 4s" for models without reasoning), ticking each half second. When `reasoning` text arrives, a disclosure opens above the answer ("Thinking 12s") and streams the summary in a quiet left-ruled block. When the first `delta` arrives it becomes "Thought for 18s" and collapses, unless the person opened or closed it themselves, in which case their choice is respected. `ping` events only keep the connection alive and never change the UI.
- **Inline notices** (`notice` events) sit above the answer as a quiet sunken line with an info icon, never a banner or toast: "Earlier messages were shortened to fit this model's limit." and "This model reads documents as plain text. Tables, layout and pictures in the file may be lost."
- **Attachment picker** (Attach menu) lists "Upload a document" and "Upload an image" with limits. For text-only models the image row is disabled with the reason ("Claude... can't see images") and a "Switch to a model that can see images" action. After attaching, the composer warns: text-only model plus image is an error that blocks send; spreadsheet plus non-document model is an error (suggest CSV or switch); PDF or Word plus non-document model is an info line. The model picker rows disable models that cannot see an attached image.
- **Titles.** A new chat shows the first words of the prompt, then swaps to the generated title (`title` event) with the sidebar and topbar updating in place and a polite announcement.
- **Model picker hints** are plain: "Reads images and documents", "Reads documents as plain text, no images", "Can think harder".

## 10. Components

Each maps to a React Aria Components primitive where one exists. States listed are the ones the build must implement; all share the focus ring, hover, pressed (`scale(.97)`, 120 ms) and disabled treatment unless noted.

| Component | RAC primitive | States and notes |
|---|---|---|
| Button (primary, secondary, ghost, danger, link, icon) | `Button`, `Link` | default, hover, pressed, focus-visible, disabled, pending (spinner replaces label, width kept), `aria-pressed` for toggles (Think harder, thumbs) |
| Text field, textarea, search | `TextField`, `Input`, `TextArea`, `SearchField`, `Label`, `Text slot=description`, `FieldError` | label above, helper below, error below with icon; `aria-invalid`; 40 px (44 coarse) |
| Password field | `TextField` + `Button` | Show/Hide button with `aria-pressed`; autocomplete `current-password` or `new-password` |
| Email field for sign-in | `TextField` | `autocomplete="username webauthn"` enables passkey autofill |
| One-time code | `TextField` | `inputmode=numeric`, `autocomplete=one-time-code`, 6 digits |
| Select | `Select`, `ListBox`, `Popover` | role, model, category, theme in admin (the prototype uses native selects for brevity) |
| Switch | `Switch` | on, off, focus, disabled; label always present (visually hidden in tables) |
| Radio group and radio cards | `RadioGroup`, `Radio` | sign-up mode, workspace visibility, default model |
| Checkbox | `Checkbox` | require approval, template shown |
| Segmented control | `RadioGroup` styled | theme |
| Tabs | `Tabs`, `TabList`, `Tab`, `TabPanel` | templates gallery categories; arrows, Home, End |
| Menu | `MenuTrigger`, `Menu`, `MenuItem`, `Separator` | account, chat actions, user actions; destructive item in danger color; disabled items explain themselves in a tooltip |
| Model picker | `DialogTrigger`, `Popover`, `ListBox`, `ListBoxSection`, `Header` | grouped by provider, default badge, capability lines, disabled option with reason, bottom sheet on phone |
| Workspace picker | same | "No workspace" first; shared/personal badge |
| Attach menu | `MenuTrigger` + `FileTrigger` | image row disabled when model lacks vision |
| Drop zone | `DropZone`, `FileTrigger` | idle, drag-over (accent wash), invalid type (toast) |
| Dialog, confirm | `ModalOverlay`, `Modal`, `Dialog` (`role=alertdialog` for destructive) | focus starts on Cancel for destructive; Esc closes; focus returns to trigger |
| Tooltip | `TooltipTrigger`, `Tooltip` | 500 ms delay, then instant for siblings; never the only carrier of a label |
| Toast | `UNSTABLE_ToastRegion` (RAC) | success 6 s, pauses on hover and focus; errors persist; polite live region; Undo action |
| Disclosure | `Disclosure` | Thinking, Sources, "Show the numbers as a table" |
| Progress | `ProgressBar` | document upload |
| Table | `Table` (desktop), stacked rows on phone | sortable columns not needed at v2; empty header cells get a visually hidden "Actions" |
| Badge | none (styled span) | neutral, accent, ok, warn, bad; icon plus text |
| Banner and notice | none (`role=status` or `alert`) | info notice, warning, error block with actions |
| Composer | custom (`TextArea`, buttons) | empty, typing (autosize to 220 px), with chips, warning, streaming (send becomes Stop), disabled (limit), offline, drag-over |
| Message list | custom, `role=log` not used (see a11y) | user turn, assistant turn (thinking, notice, answer, sources, actions), error turn |
| Message actions | `Button` group | Copy, good, bad (opens inline feedback form), try again; visible on hover, focus-within, always on touch and on the last turn |
| Citation marker and sources | `Button`, `Disclosure` | numbered chip in the text jumps to and focuses the matching source |
| Code block | custom | language label, Copy code button, scrollable and focusable `pre` |
| Markdown | `react-markdown` + `remark-gfm` | tables sit in a focusable scroll region |
| Bar chart | custom SVG | one series, direct axis labels, table alternative in a disclosure |
| Passkey prompt | `Dialog` non-modal (`role=region`) | add, not now, don't ask again |

## 11. Motion

Easing: `--ease-out: cubic-bezier(.23,1,.32,1)` for anything entering or responding, `--ease-in-out: cubic-bezier(.77,0,.175,1)` for on-screen movement, `--ease-drawer: cubic-bezier(.32,.72,0,1)` for the sidebar. Never `ease-in`. Never animate from `scale(0)`: popovers start at `scale(.97)` and `opacity 0`, with `transform-origin` at the trigger side.

| Interaction | Duration | Notes |
|---|---|---|
| Button and send press | 120 ms | `scale(.97)` on `:active` |
| Hover and color changes | 150 ms | `ease` |
| Popover and tooltip | 150 ms | origin-aware; tooltip waits 500 ms, siblings skip delay |
| View change, message appear, dialog | 200 ms | fade plus 4 px rise |
| Sidebar open and close | 200 ms (desktop), 280 ms (drawer) | no animation when toggled by keyboard on desktop is acceptable; kept at 200 ms |
| Toast in | 280 ms | rises 12 px |
| Streaming | no animation | text simply appears; caret blinks at 1 Hz |

Only `transform` and `opacity` animate, except the desktop sidebar's grid column. No scroll hijacking, no parallax, no stagger on lists longer than 4.

**`prefers-reduced-motion: reduce`:** durations collapse to about 0 (token overrides), entry animations and press scale are removed, the spinner and caret slow to 2 s and are the only motion left. Streaming text still appears progressively because it is content, not decoration.

## 12. Copy guidelines

Voice: calm, direct, plain. Short sentences, active voice, second person. Say "chat", "file", "answer", "model", not "conversation thread", "attachment payload", "completion", "inference". No exclamation marks, no em dashes, no jokes in errors. Buttons are verbs ("Send invitation", "Delete chat").

| Situation | Copy |
|---|---|
| Home title and message | "Welcome to Genie" / "Ask a question, draft a message, or work from your team's documents. Your chats are saved to your history." |
| Disclaimer | "Genie can make mistakes. Check important facts before you share or act on them." |
| Composer placeholder | "Ask anything, or drop in a file" |
| Think harder tooltip | "Slower, but better on tricky questions" |
| Thinking indicator | "Thinking 12s" then "Thought for 18s" |
| Model busy (`BEDROCK_THROTTLED`) | "Claude Opus 5.5 is busy right now. A lot of people are using it. Wait a moment and try again, or choose another model. Your message was saved." [Try again] [Choose another model] |
| Too long (`CONTEXT_TOO_LONG`) | "That is too much for Mistral Large 3 to read at once. Attach the text as a file instead of pasting it, or choose a model that can read more." [Choose another model] |
| Declined (`REFUSED`) | "Claude Sonnet 5.5 declined to answer this one. Its safety filters stopped the reply. Try rephrasing your request, or choose another model." [Try again] [Choose another model] |
| Daily limit (`LIMIT_REACHED`) | "You've reached today's limit of 50 messages. It starts over tomorrow morning. Ask your administrator if you need more." (composer disabled, chats stay readable) |
| Generic (`BEDROCK_ERROR`) | "Something went wrong on our side. Your message was saved. Try again in a moment." |
| History trimmed notice | "Earlier messages were shortened to fit this model's limit. Genie kept the most recent ones." |
| Document as text notice | "This model reads documents as plain text. Tables, layout and pictures in the file may be lost." |
| Image on text-only model | "Mistral Large 3 can't see images. map.png won't be sent to it. Switch to a model that can, or remove the image." |
| Unsupported file | "Genie can't read .zip files. Use PDF, Word, Excel, CSV, HTML, text, Markdown, or an image." |
| Offline | "You're offline. Genie will reconnect on its own." Then toast "You're back online." |
| Sign-up closed | "Sign-up is closed right now. Genie accounts are created by invitation. Ask your administrator to invite you." |
| Domain not allowed | "Genie accounts are for staff with an @example.org or @example.gov email. Use your work email, or ask your administrator for an invitation." |
| Pending | "Thanks. Your account is waiting for approval. An administrator reviews every new account. We will email you as soon as you are approved." |
| Suspended | "Your account is suspended. You can't use Genie right now. If you think this is a mistake, contact your administrator." |
| Passkey prompt | "Sign in faster next time. Use Face ID, Touch ID or a security key instead of typing a password. It takes a few seconds to set up." |
| Wrong password | "That email and password don't match. Try again, or reset your password." (never says which one is wrong) |
| Destructive confirm | Title is the question ("Delete this chat?"), body states what goes and that it can't be undone, button repeats the verb ("Delete chat"). |
| 404 | "We can't find that page. The link may be old, or the chat may have been deleted. Your other chats are safe." |

Do not use: "inference", "tokens", "context window", "prompt engineering", "LLM", "hallucination", "RAG", "Bedrock" in staff-facing copy. Admin pages may say tokens (with a one-line explanation), Bedrock, model id.

## 13. Accessibility

Target: WCAG 2.2 AA.

- **Landmarks:** `aside` (sidebar, labeled), `header` (topbar), one `main` per screen (the auth screens have their own `main`), `nav` for main, history and admin links. The dock and composer sit inside the chat view. Skip link to `main` is the first focusable element.
- **Focus order:** skip link, sidebar (new chat, links, search, history, account), topbar, main content, composer. On route change focus moves to the page `h1` (or the composer on home and chat), and `document.title` updates, so screen reader users hear where they are. Dialogs trap focus, start on the first field (or Cancel when destructive) and return focus to the trigger. Menus and pickers return focus to their button.
- **Focus visibility:** 2 px `focus` outline with 2 px offset on every interactive element; inside menus and options it is inset. Contrast is at least 3:1 against every surface (Appendix A). Programmatic focus on headings shows no ring.
- **Streaming and live regions:** the answer element is `aria-busy=true` while streaming and is not itself a live region (reading every token is unusable). A visually hidden polite status region announces "Claude Sonnet 5.5 is thinking" at the start, then "The response is complete" (or "Stopped") at the end, and the new chat title. Errors use `role=alert`. Toasts use `role=status` (errors `alert`). The Thinking timer text is not live. The offline banner is `role=status`.
- **Keyboard shortcuts:**

| Keys | Action |
|---|---|
| Enter / Shift Enter | Send / new line |
| Esc | Stop writing, or close the open menu, dialog or drawer |
| Ctrl or Cmd K | Search chats |
| Alt N | New chat |
| Alt S | Show or hide the sidebar |
| Alt M | Open the model picker |
| ? | Show the shortcuts list (when not typing) |
| Arrow keys, Home, End | Move within menus, pickers and tabs |

  Shortcuts use Alt combinations and single keys so they do not collide with browser commands (Cmd Shift N, Cmd Shift O and Cmd L are taken). They are listed in the account menu, never required.
- **Targets:** 36 px minimum on desktop, 44 px on coarse pointers, never below WCAG 2.2's 24 px.
- **Tables** keep `role=table/row/cell/columnheader` when stacked on phones. Charts have an `aria-label` that states the peak, and a table alternative.
- **Color and motion:** no color-only meaning, reduced motion honored, dark and light pass the same pairs. Forms: labels above, errors linked with `aria-describedby`, required fields validated on submit with a focus move to the first error, no placeholder-as-label.
- **Passkeys and password managers:** `autocomplete` tokens as listed in the component table; do not block paste in password fields.
- **Known gap to test with real assistive tech:** the prototype's pickers use roving focus on `role=option` buttons. RAC's `ListBox` uses `aria-activedescendant`; confirm with VoiceOver and NVDA after the build. A screen reader pass is not done yet.

## 14. Sign-in and account flows

1. **Email first.** One email field and Continue. If the account has a passkey on this browser, the browser's passkey autofill can complete sign-in straight from the field.
2. **Method choice.** Passkey is the primary button ("Sign in with a passkey", with the line "Use Face ID, Touch ID or a security key"), then "Use your password", then "Email me a code" (only when `config.json` has `emailOtp`). Without a passkey the screen goes straight to the password step, with "Email me a code instead" under it. A cancelled passkey returns to the method list with a neutral note.
3. **Invited user.** After the first sign-in with the temporary password: "Set your password" with a live requirements list (8 characters, upper and lower case, a number) and a confirm field; the button stays disabled until valid.
4. **Forgot password.** Email, then code, then new password. The page never confirms whether the email has an account.
5. **Create account.** Email and password, then "Check your email" with a 6-digit code. If sign-up is closed the page says so with a Back to sign in button. If the domain is not allowed, an inline error names the allowed domains and keeps the form filled. After confirming, a person goes to "Waiting for approval" when approval is required, otherwise to sign in.
6. **Pending and suspended** are full-page states with one clear action each (Check again, Sign out).
7. **Passkey prompt** appears once after a non-passkey sign-in: a dismissible card (Set up a passkey, Not now, Don't ask again). It never steals focus and never blocks.
8. **Account page:** Profile, Passkeys (name, date added, Remove with confirmation, Add a passkey), Change password, Appearance (Light, Dark, System), Sign out.

## 15. Admin additions

- **Users:** a "Waiting for approval" table at the top (Approve, Decline with confirmation) with a count badge in the sidebar, then everyone with role select, status badge (Active, Invited, Suspended), last sign-in, and a menu (Send password reset, Suspend or Restore, Delete). An admin cannot change their own role, suspend or delete themselves; those controls are disabled.
- **Settings:** Welcome (name, title, message, disclaimer, with a live preview), Models and limits (default model, "Model that names chats", daily messages per person with 0 meaning none, most models in a comparison, "Sources read per question" for `retrievalTopK`), Sign-up (Invitation only or Anyone with an allowed email, allowed domains, require approval).
- **Models:** the table shows what each model can do in plain words, enable switch, default radio, last test result with the error text on failure, Test now, Rename, and Add a model from the available Bedrock list (added turned off until tested).

## 16. Verification

Run on the final prototype with Chromium (Playwright) via a static server.

- **axe-core 4.10.2** (rules: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice): 66 scans, **0 violations**. Scans covered 29 screens/steps in light and dark (every sign-in step, chat with citations, error chat, compare, templates, workspaces and detail, history, account, states, all 7 admin pages and both template editor views, 404) plus open model picker, attach menu, account menu and the thumbs-down form in both themes. Earlier passes caught and fixed: missing `main` and landmarks on auth screens, heading order in templates, states and admin preview, empty table header cells, and popovers outside any landmark.
- **Contrast:** 90 token pair checks computed by script, 0 failures (Appendix A).
- **Overflow at 360 px:** no horizontal page scroll on any of 24 routes (checked by script). Wide tables and code scroll inside their own focusable regions.
- **Not done:** no screen reader pass, no real-device touch test, no cross-browser run beyond Chromium, no Lighthouse run. Dark mode and phone width were checked on a subset of screens by eye (home, chat, compare, admin users), the rest by script only.

## 17. Contract gaps

Things the designed screens need that `ARCHITECTURE.md` does not define. Each is small. The prototype fakes them.

1. **Daily limit status.** The UI shows a live "limit reached" state and the copy "starts over tomorrow morning", but there is no way to read usage so far. Needs `used`, `limit` and `resetsAt` (with the server's reset timezone) on `/api/bootstrap` or a `GET /api/me/usage`, and `LIMIT_REACHED` should carry `resetsAt`. Without it the composer cannot warn at, say, 45 of 50.
2. **Pre-login configuration.** The sign-in page must know whether to show "Create an account" and which domains are allowed. `config.json` only has static `signupEnabled: true`, and `/api/bootstrap` needs a token. Needs an unauthenticated `GET /api/public-config` returning `{ appName, signupMode, allowedEmailDomains }`.
3. **Declining a sign-up.** `PATCH status` only documents `"active"` (approve). Decline needs a defined result: delete the user (the prototype's assumption, with an "account will be removed" confirmation) or a `declined` status.
4. **Notifying approved people.** The UI says "We emailed them". The contract has no approval email. Needs an SES or Cognito message on approval, or change the copy.
5. **Two ways to block a person.** Cognito `enabled` and profile `status: suspended` overlap. The design exposes only "Suspend access" (profile status, shows the friendly screen) and hides `enabled`. Confirm that is the intended single control.
6. **Compare to chat.** "Continue in a chat" on a compare column needs a way to turn a compare session (or one model's branch of it) into a single-model chat.
7. **Persist what the stream emits.** The `Message` item has no place for `reasoning` (summary text and duration), `notices` (`HISTORY_TRIMMED`, `ATTACHMENT_AS_TEXT`) or a failed turn's `error`. Without them a reloaded chat loses the Thinking section, the inline notices and the visible failure. Needs `reasoning`, `thinkingMs`, `notices[]` and `error {code, message}` on messages (or accept that they are ephemeral and design reloads without them).
8. **Retry indexing.** A `failed` or stuck `uploaded` document can only be deleted and re-uploaded. A `POST .../documents/{docId}/retry` would let the UI offer "Try again".
9. **Feedback triage.** The queue needs a reviewed or resolved flag and a server-side model filter and cursor; the contract returns only the recent list.
10. **Template categories.** `category` is free text. The editor and gallery assume a known list. Either enumerate categories in settings or let the editor accept a new one.
11. **Admin user "last active".** `lastSeenAt` is last activity, not last sign-in. The UI should label it "Last active"; the prototype says "Last signed in" and should be corrected in the build.
12. **Passkey names.** Amplify's `associateWebAuthnCredential` takes no friendly name, so the list shows what Cognito returns (device label, date). Renaming a passkey is not offered.
13. **Pending count in the sidebar.** The "2 waiting" badge needs the pending count on every admin page load (a count in `/api/me` for admins, or a cheap `?status=pending&count=1`).
14. **Compare model limits per prompt.** `maxCompareModels` is in settings but the minimum (2) and the models allowed to run in parallel are not stated.

## Appendix A: contrast results

Foreground and background hexes are the token values in `tokens.css`. "Needs" is 4.5:1 for text, 3:1 for UI boundaries, focus and chart marks.

### Light

| Foreground | Background | Role | Ratio | Needs | Result |
|---|---|---|---|---|---|
| `ink` #121e1e | `canvas` #f6f8f8 | Body text | 16.01:1 | 4.5:1 | Pass |
| `ink` #121e1e | `surface` #ffffff | Body text | 17.07:1 | 4.5:1 | Pass |
| `ink` #121e1e | `sunken` #ecf0f0 | Body text | 14.87:1 | 4.5:1 | Pass |
| `ink` #121e1e | `raised` #ffffff | Body text | 17.07:1 | 4.5:1 | Pass |
| `ink` #121e1e | `hover` #e4eaea | Text on hover | 14.03:1 | 4.5:1 | Pass |
| `ink` #121e1e | `selected` #dae7e9 | Text on selected | 13.48:1 | 4.5:1 | Pass |
| `ink-2` #3f4e4e | `canvas` #f6f8f8 | Secondary text | 8.17:1 | 4.5:1 | Pass |
| `ink-2` #3f4e4e | `surface` #ffffff | Secondary text | 8.71:1 | 4.5:1 | Pass |
| `ink-2` #3f4e4e | `sunken` #ecf0f0 | Secondary text | 7.59:1 | 4.5:1 | Pass |
| `ink-2` #3f4e4e | `hover` #e4eaea | Secondary text on hover | 7.16:1 | 4.5:1 | Pass |
| `ink-3` #566565 | `canvas` #f6f8f8 | Muted text and placeholder | 5.72:1 | 4.5:1 | Pass |
| `ink-3` #566565 | `surface` #ffffff | Muted text and placeholder | 6.10:1 | 4.5:1 | Pass |
| `ink-3` #566565 | `sunken` #ecf0f0 | Muted text and placeholder | 5.31:1 | 4.5:1 | Pass |
| `ink-3` #566565 | `hover` #e4eaea | Muted text on hover | 5.01:1 | 4.5:1 | Pass |
| `ink-3` #566565 | `selected` #dae7e9 | Muted text on selected | 4.82:1 | 4.5:1 | Pass |
| `accent` #0a6573 | `canvas` #f6f8f8 | Link and accent text | 6.31:1 | 4.5:1 | Pass |
| `accent` #0a6573 | `surface` #ffffff | Link and accent text | 6.73:1 | 4.5:1 | Pass |
| `accent` #0a6573 | `sunken` #ecf0f0 | Link and accent text | 5.86:1 | 4.5:1 | Pass |
| `accent-ink` #ffffff | `accent` #0a6573 | Primary button label | 6.73:1 | 4.5:1 | Pass |
| `accent-ink` #ffffff | `accent-hover` #07505c | Primary button label (hover) | 9.09:1 | 4.5:1 | Pass |
| `accent-soft-ink` #064650 | `accent-soft` #e0f0f2 | Accent badge text | 8.96:1 | 4.5:1 | Pass |
| `ink` #121e1e | `accent-soft` #e0f0f2 | Text on accent wash | 14.56:1 | 4.5:1 | Pass |
| `danger` #b42318 | `surface` #ffffff | Error text and icon | 6.57:1 | 4.5:1 | Pass |
| `danger` #b42318 | `canvas` #f6f8f8 | Error text and icon | 6.17:1 | 4.5:1 | Pass |
| `danger-ink` #ffffff | `danger` #b42318 | Danger button label | 6.57:1 | 4.5:1 | Pass |
| `danger-ink` #ffffff | `danger-hover` #912018 | Danger button label (hover) | 8.66:1 | 4.5:1 | Pass |
| `danger-soft-ink` #8f1d14 | `danger-soft` #fdecea | Error banner text | 7.80:1 | 4.5:1 | Pass |
| `warn-soft-ink` #6e4700 | `warn-soft` #fcf1d6 | Warning banner text | 7.29:1 | 4.5:1 | Pass |
| `ok-soft-ink` #17572f | `ok-soft` #e1f2e6 | Success banner text | 7.39:1 | 4.5:1 | Pass |
| `code-ink` #1b2a2a | `code-bg` #eef2f2 | Code text | 13.19:1 | 4.5:1 | Pass |
| `code-keyword` #0b5a94 | `code-bg` #eef2f2 | Code keyword | 6.41:1 | 4.5:1 | Pass |
| `code-string` #1e6a3b | `code-bg` #eef2f2 | Code string | 5.85:1 | 4.5:1 | Pass |
| `code-number` #964200 | `code-bg` #eef2f2 | Code number | 6.05:1 | 4.5:1 | Pass |
| `code-comment` #566464 | `code-bg` #eef2f2 | Code comment | 5.47:1 | 4.5:1 | Pass |
| `edge-strong` #76868a | `surface` #ffffff | Input border, switch track | 3.79:1 | 3:1 | Pass |
| `edge-strong` #76868a | `canvas` #f6f8f8 | Input border on canvas | 3.55:1 | 3:1 | Pass |
| `edge-strong` #76868a | `sunken` #ecf0f0 | Control border on sidebar | 3.30:1 | 3:1 | Pass |
| `focus` #0a6573 | `canvas` #f6f8f8 | Focus ring | 6.31:1 | 3:1 | Pass |
| `focus` #0a6573 | `surface` #ffffff | Focus ring | 6.73:1 | 3:1 | Pass |
| `focus` #0a6573 | `sunken` #ecf0f0 | Focus ring | 5.86:1 | 3:1 | Pass |
| `focus` #0a6573 | `accent-soft` #e0f0f2 | Focus ring | 5.74:1 | 3:1 | Pass |
| `accent` #0a6573 | `surface` #ffffff | Primary button / chart bar boundary | 6.73:1 | 3:1 | Pass |
| `accent` #0a6573 | `canvas` #f6f8f8 | Chart bar on canvas | 6.31:1 | 3:1 | Pass |
| `surface` #ffffff | `edge-strong` #76868a | Switch thumb on off-track | 3.79:1 | 3:1 | Pass |
| `accent-ink` #ffffff | `accent` #0a6573 | Switch thumb on on-track | 6.73:1 | 3:1 | Pass |

### Dark

| Foreground | Background | Role | Ratio | Needs | Result |
|---|---|---|---|---|---|
| `ink` #e8efef | `canvas` #0f1515 | Body text | 15.83:1 | 4.5:1 | Pass |
| `ink` #e8efef | `surface` #151d1d | Body text | 14.71:1 | 4.5:1 | Pass |
| `ink` #e8efef | `sunken` #0b1010 | Body text | 16.45:1 | 4.5:1 | Pass |
| `ink` #e8efef | `raised` #1b2525 | Body text | 13.47:1 | 4.5:1 | Pass |
| `ink` #e8efef | `hover` #1f2a2a | Text on hover | 12.67:1 | 4.5:1 | Pass |
| `ink` #e8efef | `selected` #243636 | Text on selected | 10.88:1 | 4.5:1 | Pass |
| `ink-2` #b8c4c4 | `canvas` #0f1515 | Secondary text | 10.30:1 | 4.5:1 | Pass |
| `ink-2` #b8c4c4 | `surface` #151d1d | Secondary text | 9.57:1 | 4.5:1 | Pass |
| `ink-2` #b8c4c4 | `sunken` #0b1010 | Secondary text | 10.71:1 | 4.5:1 | Pass |
| `ink-2` #b8c4c4 | `hover` #1f2a2a | Secondary text on hover | 8.24:1 | 4.5:1 | Pass |
| `ink-3` #94a3a3 | `canvas` #0f1515 | Muted text and placeholder | 7.05:1 | 4.5:1 | Pass |
| `ink-3` #94a3a3 | `surface` #151d1d | Muted text and placeholder | 6.55:1 | 4.5:1 | Pass |
| `ink-3` #94a3a3 | `sunken` #0b1010 | Muted text and placeholder | 7.32:1 | 4.5:1 | Pass |
| `ink-3` #94a3a3 | `hover` #1f2a2a | Muted text on hover | 5.64:1 | 4.5:1 | Pass |
| `ink-3` #94a3a3 | `selected` #243636 | Muted text on selected | 4.85:1 | 4.5:1 | Pass |
| `accent` #5cc5d4 | `canvas` #0f1515 | Link and accent text | 9.13:1 | 4.5:1 | Pass |
| `accent` #5cc5d4 | `surface` #151d1d | Link and accent text | 8.48:1 | 4.5:1 | Pass |
| `accent` #5cc5d4 | `sunken` #0b1010 | Link and accent text | 9.48:1 | 4.5:1 | Pass |
| `accent-ink` #04181c | `accent` #5cc5d4 | Primary button label | 9.02:1 | 4.5:1 | Pass |
| `accent-ink` #04181c | `accent-hover` #7ad3e0 | Primary button label (hover) | 10.60:1 | 4.5:1 | Pass |
| `accent-soft-ink` #9be0ea | `accent-soft` #11292e | Accent badge text | 10.32:1 | 4.5:1 | Pass |
| `ink` #e8efef | `accent-soft` #11292e | Text on accent wash | 13.06:1 | 4.5:1 | Pass |
| `danger` #f28b82 | `surface` #151d1d | Error text and icon | 7.17:1 | 4.5:1 | Pass |
| `danger` #f28b82 | `canvas` #0f1515 | Error text and icon | 7.72:1 | 4.5:1 | Pass |
| `danger-ink` #260805 | `danger` #f28b82 | Danger button label | 7.85:1 | 4.5:1 | Pass |
| `danger-ink` #260805 | `danger-hover` #f6a8a1 | Danger button label (hover) | 9.86:1 | 4.5:1 | Pass |
| `danger-soft-ink` #ffb4ab | `danger-soft` #3a1614 | Error banner text | 9.48:1 | 4.5:1 | Pass |
| `warn-soft-ink` #f5cf7a | `warn-soft` #33270a | Warning banner text | 9.82:1 | 4.5:1 | Pass |
| `ok-soft-ink` #8fdba6 | `ok-soft` #12301c | Success banner text | 8.77:1 | 4.5:1 | Pass |
| `code-ink` #d8e3e3 | `code-bg` #0b1010 | Code text | 14.62:1 | 4.5:1 | Pass |
| `code-keyword` #7fb8f0 | `code-bg` #0b1010 | Code keyword | 9.14:1 | 4.5:1 | Pass |
| `code-string` #8fd3a0 | `code-bg` #0b1010 | Code string | 10.94:1 | 4.5:1 | Pass |
| `code-number` #f0b27a | `code-bg` #0b1010 | Code number | 10.36:1 | 4.5:1 | Pass |
| `code-comment` #8e9d9d | `code-bg` #0b1010 | Code comment | 6.81:1 | 4.5:1 | Pass |
| `edge-strong` #6b7d80 | `surface` #151d1d | Input border, switch track | 3.97:1 | 3:1 | Pass |
| `edge-strong` #6b7d80 | `canvas` #0f1515 | Input border on canvas | 4.28:1 | 3:1 | Pass |
| `edge-strong` #6b7d80 | `sunken` #0b1010 | Control border on sidebar | 4.44:1 | 3:1 | Pass |
| `focus` #7ad3e0 | `canvas` #0f1515 | Focus ring | 10.74:1 | 3:1 | Pass |
| `focus` #7ad3e0 | `surface` #151d1d | Focus ring | 9.97:1 | 3:1 | Pass |
| `focus` #7ad3e0 | `sunken` #0b1010 | Focus ring | 11.15:1 | 3:1 | Pass |
| `focus` #7ad3e0 | `accent-soft` #11292e | Focus ring | 8.85:1 | 3:1 | Pass |
| `accent` #5cc5d4 | `surface` #151d1d | Primary button / chart bar boundary | 8.48:1 | 3:1 | Pass |
| `accent` #5cc5d4 | `canvas` #0f1515 | Chart bar on canvas | 9.13:1 | 3:1 | Pass |
| `surface` #151d1d | `edge-strong` #6b7d80 | Switch thumb on off-track | 3.97:1 | 3:1 | Pass |
| `accent-ink` #04181c | `accent` #5cc5d4 | Switch thumb on on-track | 9.02:1 | 3:1 | Pass |

Dark block and prefers-color-scheme block identical: true
