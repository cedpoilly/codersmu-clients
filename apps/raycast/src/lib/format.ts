import { Color, Icon } from "@raycast/api";

import {
  getMeetupEndsAt,
  getMeetupLifecycleStatus,
  getMeetupLinks,
  getMeetupLocationParts,
  getMeetupSlug,
  getMeetupSpeakerNames as getCoreMeetupSpeakerNames,
  getMeetupStartsAt,
  getMeetupSummary,
  getMeetupTimezone,
  type Meetup,
} from "./core";

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .join(", ");
}

function formatDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-MU", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatMeetupDay(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-MU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatMeetupRange(meetup: Meetup): string {
  const startValue = getMeetupStartsAt(meetup);
  const endValue = getMeetupEndsAt(meetup);
  if (!startValue || !endValue) {
    return "Date TBA";
  }

  const start = new Date(startValue);
  const end = new Date(endValue);
  const timezone = getMeetupTimezone(meetup);
  const sameDay =
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeZone: timezone,
    }).format(start) ===
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeZone: timezone,
    }).format(end);

  const endLabel = sameDay
    ? new Intl.DateTimeFormat("en-MU", {
        timeStyle: "short",
        timeZone: timezone,
      }).format(end)
    : formatDate(endValue, timezone);

  return `${formatDate(startValue, timezone)} to ${endLabel}`;
}

export function meetupHasCalendarSchedule(meetup: Meetup): boolean {
  return Boolean(getMeetupStartsAt(meetup) && getMeetupEndsAt(meetup));
}

export function formatMeetupLocation(meetup: Meetup): string {
  const location = getMeetupLocationParts(meetup);
  return (
    joinParts([
      location.name,
      location.address,
      location.city,
    ]) || "TBA"
  );
}

export function getMeetupStatusLabel(meetup: Meetup): string {
  const rawStatus = meetup.status.trim().toLowerCase();
  if (rawStatus === "postponed") {
    return "Postponed";
  }
  if (rawStatus === "canceled" || rawStatus === "cancelled") {
    return "Canceled";
  }

  switch (getMeetupLifecycleStatus(meetup)) {
    case "ongoing":
      return "Live";
    case "completed":
      return "Past";
    default:
      return "Upcoming";
  }
}

export function getMeetupStatusColor(meetup: Meetup): Color {
  const rawStatus = meetup.status.trim().toLowerCase();
  if (rawStatus === "postponed") {
    return Color.Yellow;
  }
  if (rawStatus === "canceled" || rawStatus === "cancelled") {
    return Color.Red;
  }

  switch (getMeetupLifecycleStatus(meetup)) {
    case "ongoing":
      return Color.Green;
    case "completed":
      return Color.SecondaryText;
    default:
      return Color.Blue;
  }
}

export function getMeetupStatusIcon(meetup: Meetup) {
  return {
    source: Icon.Circle,
    tintColor: getMeetupStatusColor(meetup),
  };
}

export function getMeetupAudienceLabel(meetup: Meetup): string | undefined {
  if (typeof meetup.seatsAvailable === "number") {
    return `${meetup.seatsAvailable} seats available`;
  }

  if (typeof meetup.attendeeCount === "number" && meetup.attendeeCount > 0) {
    return `${meetup.attendeeCount} attendees`;
  }

  return undefined;
}

export function getMeetupSpeakerNames(meetup: Meetup): string[] {
  return getCoreMeetupSpeakerNames(meetup);
}

export function getMeetupTagNames(meetup: Meetup): string[] {
  void meetup;
  return [];
}

export function meetupKeywords(meetup: Meetup): string[] {
  const location = getMeetupLocationParts(meetup);
  return [
    getMeetupSlug(meetup),
    meetup.title,
    meetup.status,
    location.name,
    location.address,
    location.city,
    ...meetup.sponsors.map((sponsor) => sponsor.name),
    ...getMeetupSpeakerNames(meetup),
    ...meetup.sessions.map((session) => session.title),
  ].filter(Boolean) as string[];
}

export function renderMeetupMarkdown(meetup: Meetup): string {
  const links = getMeetupLinks(meetup);
  const lines: string[] = [
    `# ${meetup.title}`,
    "",
    `**${getMeetupStatusLabel(meetup)}**`,
    "",
    formatMeetupRange(meetup),
    "",
    formatMeetupLocation(meetup),
    "",
    getMeetupSummary(meetup),
    "",
    "## When",
    "",
    formatMeetupRange(meetup),
    "",
    "## Where",
    "",
    formatMeetupLocation(meetup),
  ];

  if (meetup.sessions.length) {
    lines.push("", "## Sessions", "");
    for (const session of meetup.sessions) {
      const speakerNames = session.speakers
        .map((speaker) => speaker.name)
        .join(", ");
      lines.push(
        `- **${session.title}**${speakerNames ? ` (${speakerNames})` : ""}`,
      );
      if (session.description) {
        lines.push(`  ${session.description}`);
      }
    }
  } else if (getMeetupSpeakerNames(meetup).length) {
    lines.push("", "## Speakers", "");
    for (const speaker of getMeetupSpeakerNames(meetup)) {
      lines.push(`- ${speaker}`);
    }
  }

  if (meetup.sponsors.length) {
    lines.push("", "## Sponsors", "");
    for (const sponsor of meetup.sponsors) {
      lines.push(
        `- ${sponsor.name}${sponsor.website ? ` (${sponsor.website})` : ""}`,
      );
    }
  }

  if (links.meetup || links.rsvp || links.map || links.parking) {
    lines.push("", "## Links", "");
    if (links.meetup) {
      lines.push(`- [Meetup Page](${links.meetup})`);
    }
    if (links.rsvp) {
      lines.push(`- [RSVP](${links.rsvp})`);
    }
    if (links.map) {
      lines.push(`- [Map](${links.map})`);
    }
    if (links.parking) {
      lines.push(`- [Parking](${links.parking})`);
    }
  }

  return lines.join("\n");
}
