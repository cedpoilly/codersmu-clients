function getMeetupNotFoundMessage(selector: string): string {
  if (selector === "next" || selector === "current") {
    return "No upcoming meetup found.";
  }

  if (selector === "previous" || selector === "prev" || selector === "last") {
    return "No previous meetup found.";
  }

  return `Could not find meetup "${selector}".`;
}

export class MeetupNotFoundError extends Error {
  constructor(readonly selector: string) {
    super(getMeetupNotFoundMessage(selector));
    this.name = "MeetupNotFoundError";
  }
}

export function isMeetupNotFoundError(
  error: unknown,
): error is MeetupNotFoundError {
  return error instanceof MeetupNotFoundError;
}

export function isUpcomingMeetupNotFoundError(
  error: unknown,
): error is MeetupNotFoundError {
  return (
    isMeetupNotFoundError(error) &&
    (error.selector === "next" || error.selector === "current")
  );
}
