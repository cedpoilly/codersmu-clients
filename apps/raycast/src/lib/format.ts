import { Color, Icon } from "@raycast/api";

import type { Meetup } from "./core";

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
  const start = new Date(meetup.startsAt);
  const end = new Date(meetup.endsAt);
  const sameDay =
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeZone: meetup.timezone,
    }).format(start) ===
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeZone: meetup.timezone,
    }).format(end);

  const endLabel = sameDay
    ? new Intl.DateTimeFormat("en-MU", {
        timeStyle: "short",
        timeZone: meetup.timezone,
      }).format(end)
    : formatDate(meetup.endsAt, meetup.timezone);

  return `${formatDate(meetup.startsAt, meetup.timezone)} to ${endLabel}`;
}

export function formatMeetupLocation(meetup: Meetup): string {
  return (
    joinParts([
      meetup.location.name,
      meetup.location.address,
      meetup.location.city,
    ]) || "TBA"
  );
}

export function getMeetupStatusLabel(meetup: Meetup): string {
  switch (meetup.status) {
    case "ongoing":
      return "Live";
    case "completed":
      return "Past";
    default:
      return "Upcoming";
  }
}

export function getMeetupStatusColor(meetup: Meetup): Color {
  switch (meetup.status) {
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

  if (typeof meetup.rsvpCount === "number" && meetup.rsvpCount > 0) {
    return `${meetup.rsvpCount} RSVPs`;
  }

  if (typeof meetup.attendeeCount === "number" && meetup.attendeeCount > 0) {
    return `${meetup.attendeeCount} attendees`;
  }

  return undefined;
}

export function getMeetupSpeakerNames(meetup: Meetup): string[] {
  if (meetup.sessions.length) {
    return meetup.sessions.flatMap((session) =>
      session.speakers.map((speaker) => speaker.name),
    );
  }

  return meetup.speakers.map((speaker) => speaker.name);
}

export function getMeetupTagNames(meetup: Meetup): string[] {
  return meetup.tags?.filter(Boolean) ?? [];
}

export function meetupKeywords(meetup: Meetup): string[] {
  return [
    meetup.slug,
    meetup.title,
    meetup.status,
    meetup.location.name,
    meetup.location.address,
    meetup.location.city,
    ...getMeetupTagNames(meetup),
    ...meetup.speakers.map((speaker) => speaker.name),
    ...meetup.sponsors.map((sponsor) => sponsor.name),
    ...meetup.sessions.map((session) => session.title),
  ].filter(Boolean) as string[];
}

export function renderMeetupMarkdown(meetup: Meetup): string {
  const lines: string[] = [
    `# ${meetup.title}`,
    "",
    `**${getMeetupStatusLabel(meetup)}**`,
    "",
    formatMeetupRange(meetup),
    "",
    formatMeetupLocation(meetup),
    "",
    meetup.summary,
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
  } else if (meetup.speakers.length) {
    lines.push("", "## Speakers", "");
    for (const speaker of meetup.speakers) {
      lines.push(
        `- ${speaker.name}${speaker.githubUsername ? ` (@${speaker.githubUsername})` : ""}`,
      );
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

  if (getMeetupTagNames(meetup).length) {
    lines.push("", "## Tags", "");
    for (const tag of getMeetupTagNames(meetup)) {
      lines.push(`- ${tag}`);
    }
  }

  if (
    meetup.links.meetup ||
    meetup.links.rsvp ||
    meetup.links.recording ||
    meetup.links.slides ||
    meetup.links.map ||
    meetup.links.parking
  ) {
    lines.push("", "## Links", "");
    if (meetup.links.meetup) {
      lines.push(`- [Meetup Page](${meetup.links.meetup})`);
    }
    if (meetup.links.rsvp) {
      lines.push(`- [RSVP](${meetup.links.rsvp})`);
    }
    if (meetup.links.recording) {
      lines.push(`- [Recording](${meetup.links.recording})`);
    }
    if (meetup.links.slides) {
      lines.push(`- [Slides](${meetup.links.slides})`);
    }
    if (meetup.links.map) {
      lines.push(`- [Map](${meetup.links.map})`);
    }
    if (meetup.links.parking) {
      lines.push(`- [Parking](${meetup.links.parking})`);
    }
  }

  return lines.join("\n");
}
