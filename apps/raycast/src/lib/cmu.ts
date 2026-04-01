import { environment } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { join } from "node:path";
import { useState } from "react";

import {
  getMeetup,
  getMeetupsForList,
  resolveDefaultMeetupProvider,
} from "./core";
import type { Meetup } from "./core";

const extensionCacheFile = join(environment.supportPath, "meetups.json");

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

function configureExtensionCache() {
  process.env.CODERSMU_CACHE_FILE = extensionCacheFile;
}

async function loadMeetup(
  selector: string,
  forceRefresh = false,
): Promise<Meetup> {
  configureExtensionCache();

  const provider = await resolveDefaultMeetupProvider({
    forceRefresh,
    allowStaleOnError: !forceRefresh,
  });
  const meetup = await getMeetup(provider, selector);

  if (!meetup) {
    throw new MeetupNotFoundError(selector);
  }

  return meetup;
}

async function loadMeetups(forceRefresh = false): Promise<Meetup[]> {
  configureExtensionCache();

  const provider = await resolveDefaultMeetupProvider({
    forceRefresh,
    allowStaleOnError: !forceRefresh,
  });
  return getMeetupsForList(provider, "all");
}

export function useMeetup(selector: string) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const promise = usePromise(
    (target: string, nonce: number) => loadMeetup(target, nonce > 0),
    [selector, refreshNonce],
    {
      onError: async (error) => {
        if (isMeetupNotFoundError(error)) {
          return;
        }

        await showFailureToast(error, {
          title: "Could not load meetup",
          message:
            "Coders.mu is unavailable right now and there is no cached meetup data yet.",
        });
      },
    },
  );

  return {
    ...promise,
    revalidate: () => {
      setRefreshNonce((nonce) => nonce + 1);
    },
  };
}

export function useMeetups() {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const promise = usePromise(
    (nonce: number) => loadMeetups(nonce > 0),
    [refreshNonce],
    {
      onError: async (error) => {
        await showFailureToast(error, {
          title: "Could not load meetups",
          message:
            "Coders.mu is unavailable right now and there is no cached meetup data yet.",
        });
      },
    },
  );

  return {
    ...promise,
    revalidate: () => {
      setRefreshNonce((nonce) => nonce + 1);
    },
  };
}
