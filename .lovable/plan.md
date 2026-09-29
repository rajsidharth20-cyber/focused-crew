# Keep FocusBot reports private

## Changes
- Detect `@FocusBot report` and `/report` before sending a normal group message.
- Require the reporter to reply to another member’s message, then send the report directly to FocusBot’s protected server action.
- Create the report and leader/app-admin notifications without inserting the command into group chat or notifying ordinary members.
- Retain server-side membership and target validation so crafted requests cannot report invalid messages.

## Verification
- Confirm normal FocusBot commands still enter chat and receive replies.
- Confirm valid reports create a private report with a success message but no group-chat message.
- Confirm invalid reports show an error and leave no visible message.
