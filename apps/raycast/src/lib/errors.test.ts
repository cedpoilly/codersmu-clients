import { describe, expect, it } from "vitest";

import {
  MeetupNotFoundError,
  isMeetupNotFoundError,
  isUpcomingMeetupNotFoundError,
} from "./errors";

describe("MeetupNotFoundError", () => {
  it("uses the upcoming empty-state message for next/current selectors", () => {
    expect(new MeetupNotFoundError("next").message).toBe(
      "No upcoming meetup found.",
    );
    expect(new MeetupNotFoundError("current").message).toBe(
      "No upcoming meetup found.",
    );
  });

  it("uses the previous empty-state message for previous aliases", () => {
    expect(new MeetupNotFoundError("previous").message).toBe(
      "No previous meetup found.",
    );
    expect(new MeetupNotFoundError("prev").message).toBe(
      "No previous meetup found.",
    );
    expect(new MeetupNotFoundError("last").message).toBe(
      "No previous meetup found.",
    );
  });

  it("keeps generic selectors distinct from the upcoming empty state", () => {
    const error = new MeetupNotFoundError("custom-slug");

    expect(error.message).toBe('Could not find meetup "custom-slug".');
    expect(isMeetupNotFoundError(error)).toBe(true);
    expect(isUpcomingMeetupNotFoundError(error)).toBe(false);
    expect(isMeetupNotFoundError(new Error("plain error"))).toBe(false);
  });

  it("classifies only next/current not-found errors as upcoming-empty-state errors", () => {
    expect(isUpcomingMeetupNotFoundError(new MeetupNotFoundError("next"))).toBe(
      true,
    );
    expect(
      isUpcomingMeetupNotFoundError(new MeetupNotFoundError("current")),
    ).toBe(true);
    expect(
      isUpcomingMeetupNotFoundError(new MeetupNotFoundError("previous")),
    ).toBe(false);
  });
});
