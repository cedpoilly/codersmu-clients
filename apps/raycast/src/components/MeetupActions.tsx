import { Action, ActionPanel, Clipboard, Icon } from "@raycast/api";
import type { ReactNode } from "react";

import { buildCalendarUrls } from "../lib/calendar";
import type { Meetup } from "../lib/types";

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
        <Action.OpenInBrowser
          title="Add to Google Calendar"
          url={calendar.google}
          icon={Icon.Calendar}
        />
        <Action.OpenInBrowser
          title="Add to Outlook Calendar"
          url={calendar.outlook}
          icon={Icon.Calendar}
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
        <Action
          title="Copy Summary"
          icon={Icon.Clipboard}
          onAction={async () => {
            await Clipboard.copy(meetup.summary);
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
