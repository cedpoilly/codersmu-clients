import { Color, List } from "@raycast/api";
import { useState } from "react";

import { MeetupDetail } from "./components/MeetupDetail";
import { MeetupActions } from "./components/MeetupActions";
import { MeetupListMetadata } from "./components/MeetupMetadata";
import { useMeetups } from "./lib/cmu";
import {
  formatMeetupDay,
  getMeetupStatusColor,
  getMeetupStatusIcon,
  meetupKeywords,
  renderMeetupMarkdown,
} from "./lib/format";

type FilterValue = "all" | "upcoming" | "past";

export default function MeetupsCommand() {
  const { data, error, isLoading, revalidate } = useMeetups();
  const [filter, setFilter] = useState<FilterValue>("all");

  const meetups = data ?? [];
  const upcoming = meetups.filter((meetup) => meetup.status !== "completed");
  const past = meetups.filter((meetup) => meetup.status === "completed");
  const visibleUpcoming = filter === "past" ? [] : upcoming;
  const visiblePast = filter === "upcoming" ? [] : past;

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      filtering={{ keepSectionOrder: true }}
      navigationTitle="Coders.mu Meetups"
      searchBarPlaceholder="Search meetups, speakers, or topics"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter meetups"
          storeValue
          value={filter}
          onChange={(value) => setFilter(value as FilterValue)}
        >
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="Upcoming" value="upcoming" />
          <List.Dropdown.Item title="Past" value="past" />
        </List.Dropdown>
      }
    >
      {error && meetups.length === 0 ? (
        <List.EmptyView
          title="Could not load meetups"
          description="Check the Coders.mu CLI path in the extension preferences."
        />
      ) : null}

      {visibleUpcoming.length ? (
        <List.Section
          title="Upcoming"
          subtitle={String(visibleUpcoming.length)}
        >
          {visibleUpcoming.map((meetup) => (
            <List.Item
              key={meetup.id}
              title={meetup.title}
              subtitle={meetup.slug}
              icon={getMeetupStatusIcon(meetup)}
              accessories={[
                {
                  tag: {
                    value: formatMeetupDay(meetup.startsAt, meetup.timezone),
                    color: getMeetupStatusColor(meetup),
                  },
                },
              ]}
              keywords={meetupKeywords(meetup)}
              detail={
                <List.Item.Detail
                  markdown={renderMeetupMarkdown(meetup)}
                  metadata={<MeetupListMetadata meetup={meetup} />}
                />
              }
              actions={
                <MeetupActions
                  meetup={meetup}
                  onRefresh={revalidate}
                  detailTarget={
                    <MeetupDetail meetup={meetup} onRefresh={revalidate} />
                  }
                />
              }
            />
          ))}
        </List.Section>
      ) : null}

      {visiblePast.length ? (
        <List.Section title="History" subtitle={String(visiblePast.length)}>
          {visiblePast.map((meetup) => (
            <List.Item
              key={meetup.id}
              title={meetup.title}
              subtitle={meetup.slug}
              icon={getMeetupStatusIcon(meetup)}
              accessories={[
                {
                  tag: {
                    value: formatMeetupDay(meetup.startsAt, meetup.timezone),
                    color: Color.SecondaryText,
                  },
                },
              ]}
              keywords={meetupKeywords(meetup)}
              detail={
                <List.Item.Detail
                  markdown={renderMeetupMarkdown(meetup)}
                  metadata={<MeetupListMetadata meetup={meetup} />}
                />
              }
              actions={
                <MeetupActions
                  meetup={meetup}
                  onRefresh={revalidate}
                  detailTarget={
                    <MeetupDetail meetup={meetup} onRefresh={revalidate} />
                  }
                />
              }
            />
          ))}
        </List.Section>
      ) : null}

      {!visibleUpcoming.length &&
      !visiblePast.length &&
      !isLoading &&
      !error ? (
        <List.EmptyView
          title="No meetups in this view"
          description="Try switching the filter or refreshing the data."
        />
      ) : null}
    </List>
  );
}
