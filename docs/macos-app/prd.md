# Coders.mu macOS App PRD

## Summary

Coders.mu needs a lightweight macOS client that keeps developers aware of the next meetup without requiring them to keep checking the website manually.

The proposed product is a very small menu bar app focused on one job: notify users when the next meetup becomes more actionable.

## Problem

The most important meetup changes often happen between visits to the website:

- the meetup date gets confirmed
- the location is announced or changed
- RSVP opens
- speakers or sponsors are announced
- seat availability becomes urgent

Right now, those changes are easy to miss unless someone is manually checking the site or hears about them elsewhere.

## Product Goal

Build a native macOS app that watches the next meetup and sends high-signal notifications when something important changes.

## Product Shape

This should be a menu bar-first utility, not a large desktop dashboard.

For v1, it should remain menu bar-only. Clicking the menu bar icon should open the app's compact menu/popover surface, not a separate main application window.

The app should:

- sit in the menu bar
- refresh meetup data in the background
- detect meaningful changes to the next meetup
- send native macOS notifications
- expose quick actions for meetup, RSVP, and calendar links

## MVP

### In Scope

- native macOS app
- menu bar presence
- next-meetup summary popover
- background refresh
- local change detection
- native macOS notifications
- seat-threshold notifications
- launch-at-login in the first release
- quiet hours and notification snoozing in the first release
- quick actions:
  - Open Meetup Page
  - Open RSVP
  - Add to Calendar
  - Refresh Now
  - Pause Notifications
- basic preferences
- last updated timestamp

### Out of Scope

- rich archive browsing
- in-app RSVP
- account system
- cross-platform desktop support
- heavy analytics

## Notification Model

The app should notify only on changes that materially affect a user's decision or urgency.

### Priority 1

- a new upcoming meetup appears
- date or time is confirmed
- date or time changes
- location is confirmed
- location changes
- RSVP opens
- meetup is canceled or postponed

### Priority 2

- seat availability crosses meaningful thresholds

### Priority 3

- slides are published
- recording is published

Priority 3 is useful, but it does not define the initial product.

## Seat Urgency

The app should not notify on every RSVP count change. It should notify only when urgency becomes meaningful.

Suggested thresholds:

- RSVP opened
- 25 seats left
- 10 seats left
- 5 seats left

## User Experience Principles

- Ambient, not distracting
- Notification-first
- Next-meetup centric
- Actionable by default
- Low-maintenance after install

## Notification Behavior

- Notification clicks should always open the meetup page in the default browser.
- The menu bar app itself should stay focused on quick status, recent change context, and lightweight actions.
- RSVP and calendar actions can still be available from the menu bar surface, but notifications themselves should route to the meetup page.

## Success Signals

- users notice important changes without manually polling the site
- users can act immediately from a notification or the popover
- the app earns a place in the menu bar because it is useful and quiet

## Locked For v1

- v1 stays menu bar-only
- notification clicks always open the meetup page in the browser
- seat-threshold notifications ship in v1
- launch-at-login ships in the first release
- quiet hours and snoozing ship in the first release
- sponsor and speaker notifications stay out of MVP for now
