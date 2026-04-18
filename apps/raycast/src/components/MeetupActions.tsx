import { Action, ActionPanel, Icon, Keyboard } from "@raycast/api";
import type { ReactNode } from "react";

import { buildCalendarUrls, buildIcs, type Meetup } from "../lib/core";

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
  const calendar = buildCalendarUrls(meetup);

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
        {meetup.links.meetup ? (
          <Action.OpenInBrowser
            title="Open Meetup Page"
            url={meetup.links.meetup}
          />
        ) : null}
        {meetup.links.rsvp ? (
          <Action.OpenInBrowser title="Open RSVP" url={meetup.links.rsvp} />
        ) : null}
        {meetup.links.recording ? (
          <Action.OpenInBrowser
            title="Open Recording"
            url={meetup.links.recording}
          />
        ) : null}
        {meetup.links.slides ? (
          <Action.OpenInBrowser title="Open Slides" url={meetup.links.slides} />
        ) : null}
        {meetup.links.map ? (
          <Action.OpenInBrowser title="Open Map" url={meetup.links.map} />
        ) : null}
        {meetup.links.parking ? (
          <Action.OpenInBrowser
            title="Open Parking"
            url={meetup.links.parking}
          />
        ) : null}
        <Action.OpenInBrowser
          title="Add to Google Calendar"
          url={calendar.google}
          icon={Icon.Calendar}
          shortcut={{ modifiers: ["cmd", "shift"], key: "g" }}
        />
        <Action.OpenInBrowser
          title="Add to Outlook Calendar"
          url={calendar.outlook}
          icon={Icon.Calendar}
          shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard title="Copy Slug" content={meetup.slug} />
        {meetup.links.meetup ? (
          <Action.CopyToClipboard
            title="Copy Meetup URL"
            content={meetup.links.meetup}
          />
        ) : null}
        {meetup.links.rsvp ? (
          <Action.CopyToClipboard
            title="Copy RSVP URL"
            content={meetup.links.rsvp}
          />
        ) : null}
        {meetup.links.recording ? (
          <Action.CopyToClipboard
            title="Copy Recording URL"
            content={meetup.links.recording}
          />
        ) : null}
        {meetup.links.slides ? (
          <Action.CopyToClipboard
            title="Copy Slides URL"
            content={meetup.links.slides}
          />
        ) : null}
        <Action.CopyToClipboard
          title="Copy Google Calendar URL"
          content={calendar.google}
        />
        <Action.CopyToClipboard
          title="Copy Outlook Calendar URL"
          content={calendar.outlook}
        />
        <Action.CopyToClipboard title="Copy ICS" content={buildIcs(meetup)} />
        <Action.CopyToClipboard title="Copy Summary" content={meetup.summary} />
      </ActionPanel.Section>
      {onRefresh ? (
        <ActionPanel.Section title="Data">
          <Action
            title="Refresh"
            onAction={onRefresh}
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
        </ActionPanel.Section>
      ) : null}
    </ActionPanel>
  );
}
