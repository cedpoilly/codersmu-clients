import { Detail } from "@raycast/api";

import { MeetupDetail } from "./components/MeetupDetail";
import { useMeetup } from "./lib/cmu";

export default function NextMeetupCommand() {
  const { data, error, isLoading, revalidate } = useMeetup("next");

  if (error && !data) {
    return (
      <Detail
        markdown={[
          "# Coders.mu",
          "",
          "The extension could not load the next meetup.",
          "",
          "Check the `CLI Path` preference or make sure `cmu` is available on your `PATH`.",
          "",
          "## Error",
          "",
          `\`${error.message}\``,
        ].join("\n")}
      />
    );
  }

  if (!data) {
    return <Detail isLoading={isLoading} markdown="# Loading next meetup…" />;
  }

  return (
    <MeetupDetail meetup={data} isLoading={isLoading} onRefresh={revalidate} />
  );
}
