import { environment } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { join } from "node:path";
import { useState } from "react";

import { fetchMeetupBySelector, fetchMeetupList } from "./core";
import type { Meetup } from "./core";
import { MeetupNotFoundError, isMeetupNotFoundError } from "./errors";

const extensionCacheFile = join(environment.supportPath, "meetups.json");
const extensionHostedApiBaseUrl = "https://codersmu.cedpoilly.dev";

function configureExtensionCache() {
  process.env.CODERSMU_CACHE_FILE = extensionCacheFile;
  process.env.CODERSMU_HOSTED_API_BASE_URL = extensionHostedApiBaseUrl;
}

async function loadMeetup(
  selector: string,
  forceRefresh = false,
): Promise<Meetup> {
  configureExtensionCache();

  const meetup = await fetchMeetupBySelector(selector, {
    forceRefresh,
    allowStaleOnError: !forceRefresh,
  });

  if (!meetup) {
    throw new MeetupNotFoundError(selector);
  }

  return meetup;
}

async function loadMeetups(forceRefresh = false): Promise<Meetup[]> {
  configureExtensionCache();

  return fetchMeetupList("all", {
    forceRefresh,
    allowStaleOnError: !forceRefresh,
  });
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
