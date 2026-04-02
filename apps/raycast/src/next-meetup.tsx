import { Action, ActionPanel, Detail, Icon } from "@raycast/api";

import { MeetupDetail } from "./components/MeetupDetail";
import MeetupsCommand from "./meetups";
import { useMeetup } from "./lib/cmu";
import { isUpcomingMeetupNotFoundError } from "./lib/errors";

export default function NextMeetupCommand() {
  const { data, error, isLoading, revalidate } = useMeetup("next");

  if (isUpcomingMeetupNotFoundError(error) && !data) {
    return (
      <Detail
        markdown={[
          "# Coders.mu",
          "",
          "No upcoming meetup is published right now.",
          "",
          "Try the `Meetups` command to browse previous events or refresh again later.",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action.Push title="Browse Meetups" target={<MeetupsCommand />} />
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={revalidate}
            />
          </ActionPanel>
        }
      />
    );
  }

  if (error && !data) {
    return (
      <Detail
        markdown={[
          "# Coders.mu",
          "",
          "The extension could not load the next meetup.",
          "",
          "Check your network connection or try again once Coders.mu is reachable.",
          "",
          "## Error",
          "",
          `\`${error.message}\``,
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action.Push title="Browse Meetups" target={<MeetupsCommand />} />
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={revalidate}
            />
          </ActionPanel>
        }
      />
    );
  }

  if (!data) {
    return <Detail isLoading={isLoading} markdown="# Loading next meetup…" />;
  }

  return (
    <MeetupDetail meetup={data} isLoading={isLoading} onRefresh={revalidate} />
  );
}
