import type { Meetup } from "./types";

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .join(", ");
}

export function buildCalendarUrls(meetup: Meetup): {
  google: string;
  outlook: string;
} {
  const title = encodeURIComponent(meetup.title);
  const details = encodeURIComponent(
    meetup.links.meetup
      ? `${meetup.summary}\n\nMore details: ${meetup.links.meetup}`
      : meetup.summary,
  );
  const location = encodeURIComponent(
    joinParts([
      meetup.location.name,
      meetup.location.address,
      meetup.location.city,
    ]),
  );
  const start = meetup.startsAt.replace(/[-:]/g, "").replace(".000", "");
  const end = meetup.endsAt.replace(/[-:]/g, "").replace(".000", "");

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(meetup.startsAt)}&enddt=${encodeURIComponent(meetup.endsAt)}&body=${details}&location=${location}`,
  };
}
