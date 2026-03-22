import { Action, ActionPanel, Icon, List } from "@raycast/api";

import { MeetupDetail } from "./components/MeetupDetail";
import { useMeetups } from "./lib/cmu";
import { meetupKeywords } from "./lib/format";

export default function MeetupsCommand() {
  const { data, error, isLoading, revalidate } = useMeetups();

  const meetups = data ?? [];
  const upcoming = meetups.filter((meetup) => meetup.status !== "completed");
  const past = meetups.filter((meetup) => meetup.status === "completed");

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search meetups, speakers, or topics"
      isShowingDetail={false}
    >
      {error && meetups.length === 0 ? (
        <List.EmptyView
          title="Could not load meetups"
          description="Check the Coders.mu CLI path in the extension preferences."
        />
      ) : null}

      <List.Section title="Upcoming" subtitle={String(upcoming.length)}>
        {upcoming.map((meetup) => (
          <List.Item
            key={meetup.id}
            title={meetup.title}
            subtitle={meetup.slug}
            accessories={[
              { text: meetup.location.city || meetup.location.name || "TBA" },
            ]}
            keywords={meetupKeywords(meetup)}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Meetup"
                  icon={Icon.AppWindow}
                  target={
                    <MeetupDetail meetup={meetup} onRefresh={revalidate} />
                  }
                />
                <Action
                  title="Refresh"
                  onAction={revalidate}
                  icon={Icon.ArrowClockwise}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Past" subtitle={String(past.length)}>
        {past.map((meetup) => (
          <List.Item
            key={meetup.id}
            title={meetup.title}
            subtitle={meetup.slug}
            accessories={[
              { text: meetup.location.city || meetup.location.name || "TBA" },
            ]}
            keywords={meetupKeywords(meetup)}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Meetup"
                  icon={Icon.AppWindow}
                  target={
                    <MeetupDetail meetup={meetup} onRefresh={revalidate} />
                  }
                />
                <Action
                  title="Refresh"
                  onAction={revalidate}
                  icon={Icon.ArrowClockwise}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
