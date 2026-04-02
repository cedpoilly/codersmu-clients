import { Detail } from "@raycast/api";

import { renderMeetupMarkdown } from "../lib/format";
import type { Meetup } from "../lib/core";
import { MeetupActions } from "./MeetupActions";
import { MeetupDetailMetadata } from "./MeetupMetadata";

interface MeetupDetailProps {
  meetup: Meetup;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function MeetupDetail({
  meetup,
  isLoading,
  onRefresh,
}: MeetupDetailProps) {
  return (
    <Detail
      markdown={renderMeetupMarkdown(meetup)}
      isLoading={isLoading}
      navigationTitle={meetup.title}
      metadata={<MeetupDetailMetadata meetup={meetup} />}
      actions={<MeetupActions meetup={meetup} onRefresh={onRefresh} />}
    />
  );
}
