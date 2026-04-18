import { Action, ActionPanel, Clipboard, Icon } from "@raycast/api";
import type { ReactNode } from "react";

import {
  buildCalendarUrls,
  buildIcs,
  getMeetupLinks,
  getMeetupSlug,
  getMeetupSummary,
  type Meetup,
} from "../lib/core";
import { meetupHasCalendarSchedule } from "../lib/format";

interface MeetupActionsProps {
  meetup: Meetup;
  onRefresh?: () => void;
  detailTarget?: ReactNode;
}

export function MeetupActions({
  meetup,
  onRefresh,
  detailTarget,
}: MeetupActionsProps) {
  const calendar = meetupHasCalendarSchedule(meetup)
    ? buildCalendarUrls(meetup)
    : null;
  const links = getMeetupLinks(meetup);

  return (
    <ActionPanel>
      {detailTarget ? (
        <Action.Push
          title="Show Meetup"
          target={detailTarget}
          icon={Icon.AppWindow}
        />
      ) : null}
      <ActionPanel.Section title="Open">
        {links.meetup ? (
          <Action.OpenInBrowser
            title="Open Meetup Page"
            url={links.meetup}
          />
        ) : null}
        {links.rsvp ? (
          <Action.OpenInBrowser title="Open RSVP" url={links.rsvp} />
        ) : null}
        {links.map ? (
          <Action.OpenInBrowser title="Open Map" url={links.map} />
        ) : null}
        {links.parking ? (
          <Action.OpenInBrowser title="Open Parking" url={links.parking} />
        ) : null}
        {calendar ? (
          <Action.OpenInBrowser
            title="Add to Google Calendar"
            url={calendar.google}
            icon={Icon.Calendar}
          />
        ) : null}
        {calendar ? (
          <Action.OpenInBrowser
            title="Add to Outlook Calendar"
            url={calendar.outlook}
            icon={Icon.Calendar}
          />
        ) : null}
      </ActionPanel.Section>
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard title="Copy Slug" content={getMeetupSlug(meetup)} />
        {links.meetup ? (
          <Action.CopyToClipboard
            title="Copy Meetup URL"
            content={links.meetup}
          />
        ) : null}
        {links.rsvp ? (
          <Action.CopyToClipboard
            title="Copy RSVP URL"
            content={links.rsvp}
          />
        ) : null}
        {calendar ? (
          <Action.CopyToClipboard
            title="Copy Google Calendar URL"
            content={calendar.google}
          />
        ) : null}
        {calendar ? (
          <Action.CopyToClipboard
            title="Copy Outlook Calendar URL"
            content={calendar.outlook}
          />
        ) : null}
        {calendar ? (
          <Action.CopyToClipboard title="Copy ICS" content={buildIcs(meetup)} />
        ) : null}
        <Action
          title="Copy Summary"
          icon={Icon.Clipboard}
          onAction={async () => {
            await Clipboard.copy(getMeetupSummary(meetup));
          }}
        />
      </ActionPanel.Section>
      {onRefresh ? (
        <ActionPanel.Section title="Data">
          <Action
            title="Refresh"
            onAction={onRefresh}
            icon={Icon.ArrowClockwise}
          />
        </ActionPanel.Section>
      ) : null}
    </ActionPanel>
  );
}
