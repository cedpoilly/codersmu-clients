import { usePromise } from "@raycast/utils";
import { useState } from "react";

import {
  getMeetup,
  getMeetupsForList,
  resolveDefaultMeetupProvider,
} from "./core";
import type { Meetup } from "./core";

function getMeetupNotFoundMessage(selector: string): string {
  if (selector === "next" || selector === "current") {
    return "No upcoming meetup found.";
  }

  if (selector === "previous" || selector === "prev" || selector === "last") {
    return "No previous meetup found.";
  }

  return `Could not find meetup "${selector}".`;
}

async function loadMeetup(
  selector: string,
  forceRefresh = false,
): Promise<Meetup> {
  const provider = await resolveDefaultMeetupProvider({ forceRefresh });
  const meetup = await getMeetup(provider, selector);

  if (!meetup) {
    throw new Error(getMeetupNotFoundMessage(selector));
  }

  return meetup;
}

async function loadMeetups(forceRefresh = false): Promise<Meetup[]> {
  const provider = await resolveDefaultMeetupProvider({ forceRefresh });
  return getMeetupsForList(provider, "all");
}

export function useMeetup(selector: string) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const promise = usePromise(
    (target: string, nonce: number) => loadMeetup(target, nonce > 0),
    [selector, refreshNonce],
    {
      failureToastOptions: {
        title: "Could not load meetup",
        message:
          "Coders.mu is unavailable right now and there is no cached meetup data yet.",
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
      failureToastOptions: {
        title: "Could not load meetups",
        message:
          "Coders.mu is unavailable right now and there is no cached meetup data yet.",
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
