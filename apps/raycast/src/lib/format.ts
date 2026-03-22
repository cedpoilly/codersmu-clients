import type { Meetup } from "./types";

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

function formatRange(meetup: Meetup): string {
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

export function meetupKeywords(meetup: Meetup): string[] {
  return [
    meetup.slug,
    meetup.status,
    meetup.location.name,
    meetup.location.city,
    ...meetup.speakers.map((speaker) => speaker.name),
    ...meetup.sessions.map((session) => session.title),
  ].filter(Boolean) as string[];
}

export function renderMeetupMarkdown(meetup: Meetup): string {
  const lines: string[] = [
    `# ${meetup.title}`,
    "",
    meetup.summary,
    "",
    "## When",
    "",
    formatRange(meetup),
    "",
    "## Where",
    "",
    joinParts([
      meetup.location.name,
      meetup.location.address,
      meetup.location.city,
    ]) || "TBA",
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

  if (
    meetup.links.meetup ||
    meetup.links.rsvp ||
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
    if (meetup.links.map) {
      lines.push(`- [Map](${meetup.links.map})`);
    }
    if (meetup.links.parking) {
      lines.push(`- [Parking](${meetup.links.parking})`);
    }
  }

  return lines.join("\n");
}
