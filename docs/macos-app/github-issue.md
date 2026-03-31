## Why

Coders.mu updates often matter most when they become actionable: **RSVP opens**, the **date gets confirmed**, the **location changes**, or **seats start running low**.

Right now, people have to keep checking the website manually or hear about changes elsewhere. A small desktop client could make those changes much harder to miss.

## Proposal

Explore a **very small macOS menu bar app** focused on the **next meetup only**.

The app would watch the upcoming meetup and send **native macOS notifications** when meaningful changes happen.

For **v1**:

- stay **menu bar-only**
- open the **meetup page in the browser** when a notification is clicked

## MVP

- **menu bar-first app**
- **next-meetup summary popover**
- **background refresh**
- **local change detection**
- **native macOS notifications for high-signal changes**
- **seat-threshold notifications**
- **launch-at-login**
- **quiet hours and notification snoozing**
- quick actions for meetup page, RSVP, and calendar

## Example Notifications

- **RSVP is now open**
- **Date confirmed**
- **Date changed**
- **Location confirmed**
- **Location changed**
- **Only 10 seats left**
- **Meetup canceled or postponed**

## Notes

**Current direction:**

- keep **v1 menu bar-only**
- open the **meetup page in the browser** when a notification is clicked
- include **seat-threshold notifications** in v1
- include **launch-at-login** in the first release
- include **quiet hours and snoozing** in the first release
- leave **sponsor and speaker notifications out of MVP** for now
