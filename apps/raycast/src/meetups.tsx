import { Color, List } from "@raycast/api";
import { useState } from "react";

import { MeetupDetail } from "./components/MeetupDetail";
import { MeetupActions } from "./components/MeetupActions";
import { MeetupListMetadata } from "./components/MeetupMetadata";
import {
  getMeetupLifecycleStatus,
  getMeetupLocationParts,
  getMeetupSlug,
  getMeetupStartsAt,
  getMeetupTimezone,
} from "./lib/core";
import { useMeetups } from "./lib/cmu";
import {
  formatMeetupDay,
  getMeetupAudienceLabel,
  getMeetupStatusColor,
  getMeetupStatusIcon,
  meetupKeywords,
  renderMeetupMarkdown,
} from "./lib/format";

type FilterValue = "all" | "upcoming" | "past";

function getMeetupAccessories(
  meetup: Parameters<typeof getMeetupStatusIcon>[0],
) {
  const startsAt = getMeetupStartsAt(meetup);
  const timezone = getMeetupTimezone(meetup);
  const location = getMeetupLocationParts(meetup);
  const lifecycleStatus = getMeetupLifecycleStatus(meetup);
  const accessories: List.Item.Accessory[] = [
    {
      tag: {
        value: startsAt ? formatMeetupDay(startsAt, timezone) : "TBA",
        color:
          lifecycleStatus === "completed"
            ? Color.SecondaryText
            : getMeetupStatusColor(meetup),
      },
    },
  ];

  const audience = getMeetupAudienceLabel(meetup);
  if (audience) {
    accessories.unshift({ text: audience });
  }

  if (location.city ?? location.address) {
    accessories.unshift({ text: location.city ?? location.address! });
  }

  return accessories;
}

export default function MeetupsCommand() {
  const { data, error, isLoading, revalidate } = useMeetups();
  const [filter, setFilter] = useState<FilterValue>("all");

  const meetups = data ?? [];
  const isCanceled = (status: string) => {
    const normalized = status.trim().toLowerCase();
    return normalized === "canceled" || normalized === "cancelled";
  };

  const live = meetups.filter(
    (meetup) => getMeetupLifecycleStatus(meetup) === "ongoing",
  );
  const upcoming = meetups.filter((meetup) => {
    if (meetup.status.trim().toLowerCase() === "postponed") {
      return true;
    }
    if (isCanceled(meetup.status)) {
      return false;
    }
    return getMeetupLifecycleStatus(meetup) === "scheduled";
  });
  const past = meetups.filter(
    (meetup) =>
      isCanceled(meetup.status) ||
      getMeetupLifecycleStatus(meetup) === "completed",
  );
  const visibleLive = filter === "past" ? [] : live;
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
          description="Check your network connection or try again once Coders.mu is reachable."
        />
      ) : null}

      {visibleLive.length ? (
        <List.Section title="Live" subtitle={String(visibleLive.length)}>
          {visibleLive.map((meetup) => (
            <List.Item
              key={meetup.id}
              title={meetup.title}
              subtitle={getMeetupSlug(meetup)}
              icon={getMeetupStatusIcon(meetup)}
              accessories={getMeetupAccessories(meetup)}
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

      {visibleUpcoming.length ? (
        <List.Section
          title="Upcoming"
          subtitle={String(visibleUpcoming.length)}
        >
          {visibleUpcoming.map((meetup) => (
            <List.Item
              key={meetup.id}
              title={meetup.title}
              subtitle={getMeetupSlug(meetup)}
              icon={getMeetupStatusIcon(meetup)}
              accessories={getMeetupAccessories(meetup)}
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
              subtitle={getMeetupSlug(meetup)}
              icon={getMeetupStatusIcon(meetup)}
              accessories={getMeetupAccessories(meetup)}
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
      !visibleLive.length &&
      !visiblePast.length &&
      !isLoading &&
      !error ? (
        <List.EmptyView
          title="No meetups in this view"
          description={
            filter === "upcoming"
              ? "No live or upcoming meetup is published right now."
              : filter === "past"
                ? "No previous meetup is available."
                : "No meetup data is available right now."
          }
        />
      ) : null}
    </List>
  );
}
