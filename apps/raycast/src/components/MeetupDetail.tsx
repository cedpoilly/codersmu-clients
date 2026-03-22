import { Detail } from "@raycast/api";

import { renderMeetupMarkdown } from "../lib/format";
import type { Meetup } from "../lib/types";
import { MeetupActions } from "./MeetupActions";

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
      actions={<MeetupActions meetup={meetup} onRefresh={onRefresh} />}
    />
  );
}
