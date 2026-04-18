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
  formatMeetupRange,
  getMeetupAudienceLabel,
  meetupHasCalendarSchedule,
  getMeetupStatusColor,
  getMeetupStatusIcon,
  meetupKeywords,
  renderMeetupMarkdown,
} from "./format";

const baseMeetup: Meetup = {
  id: "future-meetup",
  title: "The Test Meetup",
  description: "A meetup about testing the Raycast layer.",
  date: "2099-04-18",
  startTime: "10:00",
  endTime: "14:00",
  venue: "The Venue",
  location: "Vivea Business Park, Moka",
  status: "published",
  photos: [],
  sessions: [
    {
      id: "shipping-session",
      title: "Shipping Better Clients",
      description: "How to avoid regressions while shipping quickly.",
      order: 1,
      speakers: [
        {
          id: "grace-hopper",
          name: "Grace Hopper",
          githubUsername: null,
          avatarUrl: null,
          featured: 1,
        },
      ],
    },
  ],
  sponsors: [
    {
      id: "codersmu-sponsor",
      name: "Coders.mu",
      website: "https://coders.mu",
      logoUrl: null,
      sponsorTypes: ["community"],
      logoBg: null,
      status: "active",
    },
  ],
  attendeeCount: 22,
  seatsAvailable: 11,
  acceptingRsvp: 1,
  rsvpLink: "https://coders.mu/rsvp/future-meetup",
  mapUrl: "https://maps.example.com/future-meetup",
  parkingLocation: "https://parking.example.com/future-meetup",
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
        venue: "",
        location: undefined,
      }),
    ).toBe("TBA");
  });

  it("treats unscheduled meetups as TBA and disables calendar actions", () => {
    const tbaMeetup = {
      ...baseMeetup,
      date: null,
      startTime: null,
      endTime: null,
    };

    expect(formatMeetupRange(tbaMeetup)).toBe("Date TBA");
    expect(meetupHasCalendarSchedule(tbaMeetup)).toBe(false);
    expect(meetupHasCalendarSchedule(baseMeetup)).toBe(true);
  });

  it("keeps audience labels prioritized by seats, then RSVPs, then attendees", () => {
    expect(getMeetupAudienceLabel(baseMeetup)).toBe("11 seats available");
    expect(
      getMeetupAudienceLabel({
        ...baseMeetup,
        seatsAvailable: null,
      }),
    ).toBe("22 attendees");
    expect(
      getMeetupAudienceLabel({
        ...baseMeetup,
        seatsAvailable: null,
        attendeeCount: 0,
      }),
    ).toBeUndefined();
  });

  it("exposes Raycast search keywords and status metadata from meetup content", () => {
    expect(meetupKeywords(baseMeetup)).toEqual(
      expect.arrayContaining([
        "2099-04-18-the-test-meetup",
        "The Test Meetup",
        "published",
        "The Venue",
        "Vivea Business Park, Moka",
        "Coders.mu",
        "Shipping Better Clients",
      ]),
    );
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
    expect(markdown).toContain("## Links");
    expect(markdown).toContain(
      "- [Parking](https://parking.example.com/future-meetup)",
    );
  });
});
