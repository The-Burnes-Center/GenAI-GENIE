// Sample answers and reasoning for mock mode. Copied from design/prototype/data.js so the mock reads like the design.
export const MD_SNOW = `Here is a plain-language summary for the front desk.

## What changed this year

- **Parking bans start earlier.** The ban now begins at 7 p.m. instead of 9 p.m. when four or more inches of snow are forecast.
- **Warming centers open sooner.** Two library branches open as warming centers when the temperature falls below 20 degrees.
- **One alert system.** Residents get text alerts through a single sign-up instead of three separate lists.

## What residents need to do

| Action | Who | By when |
|---|---|---|
| Move cars off marked snow routes | Anyone parked on a snow route | Before the ban starts |
| Clear the sidewalk in front of the home | Property owners | Within 6 hours after snow stops |
| Sign up for text alerts | Everyone | Before December 1 |

## A short script for the front desk

"The parking ban now starts at 7 p.m. when heavy snow is forecast. You can check your street on the map, or sign up for text alerts at the link on our website."

The parking map shows the snow routes in blue. I could not read the street names in the lower-right corner, so please check those against the original.`
export const MD_FORMULA = `Assuming the dates are in column B and the status is in column D, use this formula:

\`\`\`excel
=COUNTIFS(D:D,"Open",B:B,"<"&TODAY()-3)
\`\`\`

It counts rows where the status is "Open" and the date is more than 3 days ago. Change \`D:D\` and \`B:B\` if your columns are different.`
export const MD_LEAVE = `Eligible employees get **12 weeks** of paid parental leave after a birth, adoption, or foster placement [1]. You can take it in one block or split it into shorter periods, as long as all of it is used within 12 months of the child’s arrival [2].

A few things to know:

- You need to have worked here for at least 6 months to qualify.
- Give your manager at least 30 days’ notice when you can [3].
- Part-time staff receive leave in proportion to their regular hours.

For your own situation, confirm the details with Human Resources.`
export const THINK_SNOW = 'The person wants a summary for front-desk staff, so the reader is not an expert. I should lead with what changed, then what residents must do, and keep the wording simple. The table is the clearest way to show who does what and by when. The map image is partly unreadable in one corner, so I should say that instead of guessing.'

export const CANNED = {
  general: 'Here is a first draft you can adjust.\n\n## Draft\n\nThank you for your message. I have reviewed your request and have three points to cover.\n\n- **Timing:** Confirm the date and who is responsible.\n- **Next step:** Say clearly what you need from the reader.\n- **Contact:** Add the best way to reach you.\n\nTell me the audience and tone you want, and I will tighten this up.',
  think: 'The question is short and the answer should be direct. I will start with the main point, then add only the details that change what the person should do. I should keep the wording plain and avoid hedging unless something is really unclear.',
  thinkDeep: 'Let me work out what is being asked and what could go wrong. First, restate the goal in plain terms. Second, list the facts I am sure of, and the ones I am not. Third, check whether any step depends on a date or a number that I should flag. The simplest correct answer is probably better than a long one, but I should mention the one assumption that matters. Finally, I will keep the tone calm and practical for someone who is not an expert.',
}
