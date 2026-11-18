# Admin guide

Admins run Genie from the admin console: open the account menu at the bottom of the sidebar and choose **Admin console**. Only members of the Cognito `admin` group see it, and the server checks the role on every admin request.

Every admin change is recorded in the audit log.

## People

**Users** lists everyone with their role, status and when they were last active.

- **Invite** someone by email and choose their role. Cognito emails them a temporary password; they set their own on first sign-in.
- **Approve or decline** sign-ups waiting in the approval queue (shown when **Require approval** is on). Declining removes the account.
- **Suspend** blocks sign-in immediately and signs the person out everywhere. Unsuspend restores access.
- **Reset password** emails the person a reset code.
- **Change role** between Member and Admin.
- You cannot suspend, demote or delete your own account.

## Sign-up settings

In **Settings > Sign-up**:

| Setting | Effect |
|---|---|
| Sign-up mode | **Off**: only invited people can join. **Open**: anyone can create an account, limited by the next two settings. |
| Allowed email domains | When set, only addresses at these domains can sign up (for example `example.org`). Leave empty to allow any domain. |
| Require approval | New sign-ups wait in the approval queue until an admin approves them. |

## Models

**Models** lists every model in the catalog.

- **On/off** controls whether staff can pick a model.
- **Default** is the model new chats start with. It cannot be turned off or removed.
- **Test** sends a short request and shows whether the model answered and how fast.
- **Edit** changes the label, description, capabilities (reads images, reads documents, can think harder, accepts a temperature, supports prompt caching), context window and maximum reply length.
- **Add a model** lists Bedrock models and inference profiles available to the account that are not in the catalog yet.

Capabilities matter: Genie only sends images to models marked as reading images, sends documents as files only to models marked as reading documents (other models receive the extracted text), and offers **Think harder** only on models that support it.

## Templates

**Templates** are ready-made starting points staff can pick from the gallery. Each has a title, description, category, the instructions given to the model (system prompt) and an optional starter prompt placed in the composer. Categories come from **Settings**.

## Settings

| Setting | Effect |
|---|---|
| App name, welcome title and message, disclaimer | Text on the sign-in and home screens. |
| Default model | The model new chats start with. Out of the box this is Claude Haiku 5.5: it costs about a twentieth of Sonnet per message and handles everyday writing and summaries well. |
| Title model | The model that writes short chat titles and runs **Help me ask** (a fast, low-cost model works best). |
| Daily message limit | Messages per person per day (default 100). `0` means unlimited. Each model answer counts, so a three-model compare uses three. **Help me ask** has its own limit of 50 a day and never uses messages. |
| Time zone | When the daily limit starts over (midnight in this time zone). Changing it mid-day starts a fresh count. |
| Compare models | The most models a person can compare at once (2 to 3 recommended). |
| Sources per question | How many passages document workspaces retrieve per question. |
| Template categories | The list used by the template editor and gallery. |

### Help and learning

These shape what people new to AI see: the welcome card on their first visit, the **Learn** page, and how the assistant behaves.

| Setting | Effect |
|---|---|
| Assistant instructions | Sent to the model with every chat, before any template's instructions. The default asks for plain language, honesty about uncertainty, reminders to check names, numbers, dates and laws, and an accurate description of what Genie can do. Up to 4,000 characters. |
| What not to share | Up to 10 short rules shown on the welcome card and the Learn page. Replace the defaults with your organization's policy. |
| Learning links | Up to 8 https links on the Learn page, such as your organization's AI training. The default is the free InnovateUS course Responsible AI for Public Professionals. |
| Help contact | An email address or https link shown on the Learn page as the place to reach a person. Leave empty to hide it. |

Beginner tips (the welcome card and the one-time feature tips) are remembered per person. Anyone can bring them back from **Account**, **Show tips again**.

## Usage, feedback and audit

- **Usage** shows requests and tokens by day, by model and by person for a date range of up to 92 days.
- **Feedback** lists thumbs-up and thumbs-down ratings with the comment, the model and an excerpt. Mark items reviewed as you work through them.
- **Audit log** lists every admin action, including attempts that were refused.

## Shared workspaces

Admins can create **shared** workspaces whose documents everyone can ask about. Only the owner or an admin can add or remove documents. Personal workspaces are visible only to their owner.
