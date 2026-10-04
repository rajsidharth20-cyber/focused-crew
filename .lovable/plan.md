# Strengthen FocusBot moderation

## What will change
- Keep reports private and process them immediately from the replied-to group message.
- Count distinct reporters for the same member inside the same group; after more than three members report them, temporarily block that member from sending group messages.
- Make automatic moderation actively remove high-confidence abusive, threatening, harassing, or targeted attacks when automatic deletion is enabled.
- Enforce both group-level restrictions and app-admin account restrictions at the database boundary, so blocked members cannot bypass the interface.
- Record moderation actions and notify the restricted member and group leaders without exposing reporter identities to the group.

## Safety rules
- Four distinct reporters are required; duplicate reports by one person count once.
- Reports remain reviewable by group leaders and app admins and never appear as public chat messages.
- Automatic deletion is limited to high-confidence violations; uncertain messages remain flagged for human review.
- Temporary restrictions expire automatically according to the group's configured mute duration.

## Verification
- Check report privacy, threshold counting, restriction enforcement, abusive-message deletion, and admin restrictions.
- Run the app checks and inspect the latest preview status.

## Technical details
- Add a transactional database function for report counting and restriction creation to prevent concurrent reports bypassing the threshold.
- Extend the existing FocusBot server handler and existing restriction tables; do not create a parallel chat or moderation system.
