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
| Default model | The model new chats start with. |
| Title model | The model that writes short chat titles (a fast, low-cost model works best). |
| Daily message limit | Messages per person per day. `0` means unlimited. Each model answer counts, so a three-model compare uses three. |
| Time zone | When the daily limit starts over (midnight in this time zone). Changing it mid-day starts a fresh count. |
| Compare models | The most models a person can compare at once (2 to 3 recommended). |
| Sources per question | How many passages document workspaces retrieve per question. |
| Template categories | The list used by the template editor and gallery. |

## Usage, feedback and audit

- **Usage** shows requests and tokens by day, by model and by person for a date range of up to 92 days.
- **Feedback** lists thumbs-up and thumbs-down ratings with the comment, the model and an excerpt. Mark items reviewed as you work through them.
- **Audit log** lists every admin action, including attempts that were refused.

## Shared workspaces

Admins can create **shared** workspaces whose documents everyone can ask about. Only the owner or an admin can add or remove documents. Personal workspaces are visible only to their owner.
