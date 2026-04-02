import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@raycast/api", () => ({
  Color: {
    Green: "green",
    SecondaryText: "secondary",
    Blue: "blue",
  },
  Icon: {
    Circle: "circle",
  },
}));

import type { Meetup } from "./core";
import {
  formatMeetupLocation,
  getMeetupAudienceLabel,
  getMeetupStatusColor,
  getMeetupStatusIcon,
  getMeetupTagNames,
  meetupKeywords,
  renderMeetupMarkdown,
} from "./format";

const baseMeetup: Meetup = {
  id: "future-meetup",
  slug: "2099-04-18-the-test-meetup",
  title: "The Test Meetup",
  summary: "A meetup about testing the Raycast layer.",
  startsAt: "2099-04-18T06:00:00.000Z",
  endsAt: "2099-04-18T10:00:00.000Z",
  timezone: "Indian/Mauritius",
  status: "scheduled",
  location: {
    name: "The Venue",
    address: "Vivea Business Park",
    city: "Moka",
  },
  speakers: [
    {
      name: "Ada Lovelace",
      githubUsername: "ada",
    },
  ],
  sessions: [
    {
      title: "Shipping Better Clients",
      description: "How to avoid regressions while shipping quickly.",
      speakers: [
        {
          name: "Grace Hopper",
        },
      ],
    },
  ],
  sponsors: [
    {
      name: "Coders.mu",
      website: "https://coders.mu",
      sponsorTypes: ["community"],
    },
  ],
  tags: ["testing", "raycast"],
  attendeeCount: 22,
  seatsAvailable: 11,
  rsvpCount: 8,
  acceptingRsvp: true,
  links: {
    meetup: "https://coders.mu/meetup/future-meetup",
    rsvp: "https://coders.mu/rsvp/future-meetup",
    recording: "https://videos.example.com/future-meetup",
    slides: "https://slides.example.com/future-meetup",
    map: "https://maps.example.com/future-meetup",
    parking: "https://parking.example.com/future-meetup",
  },
};

describe("Raycast meetup formatting", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("formats locations and falls back to TBA when nothing useful is present", () => {
    expect(formatMeetupLocation(baseMeetup)).toBe(
      "The Venue, Vivea Business Park, Moka",
    );

    expect(
      formatMeetupLocation({
        ...baseMeetup,
        location: {
          name: "",
          address: undefined,
          city: undefined,
        },
      }),
    ).toBe("TBA");
  });

  it("keeps audience labels prioritized by seats, then RSVPs, then attendees", () => {
    expect(getMeetupAudienceLabel(baseMeetup)).toBe("11 seats available");
    expect(
      getMeetupAudienceLabel({
        ...baseMeetup,
        seatsAvailable: null,
      }),
    ).toBe("8 RSVPs");
    expect(
      getMeetupAudienceLabel({
        ...baseMeetup,
        seatsAvailable: null,
        rsvpCount: 0,
      }),
    ).toBe("22 attendees");
    expect(
      getMeetupAudienceLabel({
        ...baseMeetup,
        seatsAvailable: null,
        rsvpCount: 0,
        attendeeCount: 0,
      }),
    ).toBeUndefined();
  });

  it("exposes Raycast search keywords and status metadata from meetup content", () => {
    expect(meetupKeywords(baseMeetup)).toEqual(
      expect.arrayContaining([
        "2099-04-18-the-test-meetup",
        "The Test Meetup",
        "scheduled",
        "The Venue",
        "Vivea Business Park",
        "Moka",
        "testing",
        "raycast",
        "Ada Lovelace",
        "Coders.mu",
        "Shipping Better Clients",
      ]),
    );
    expect(getMeetupTagNames(baseMeetup)).toEqual(["testing", "raycast"]);
    expect(getMeetupStatusColor(baseMeetup)).toBe("blue");
    expect(getMeetupStatusIcon(baseMeetup)).toEqual({
      source: "circle",
      tintColor: "blue",
    });
  });

  it("renders Raycast markdown with sessions, tags, sponsors, and all supported links", () => {
    const markdown = renderMeetupMarkdown(baseMeetup);

    expect(markdown).toContain("# The Test Meetup");
    expect(markdown).toContain("## Sessions");
    expect(markdown).toContain("- **Shipping Better Clients** (Grace Hopper)");
    expect(markdown).toContain(
      "How to avoid regressions while shipping quickly.",
    );
    expect(markdown).toContain("## Sponsors");
    expect(markdown).toContain("- Coders.mu (https://coders.mu)");
    expect(markdown).toContain("## Tags");
    expect(markdown).toContain("- testing");
    expect(markdown).toContain("## Links");
    expect(markdown).toContain(
      "- [Recording](https://videos.example.com/future-meetup)",
    );
    expect(markdown).toContain(
      "- [Slides](https://slides.example.com/future-meetup)",
    );
    expect(markdown).toContain(
      "- [Parking](https://parking.example.com/future-meetup)",
    );
  });
});
