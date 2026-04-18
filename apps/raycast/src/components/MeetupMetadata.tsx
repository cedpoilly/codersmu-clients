import { Color, Detail, List } from "@raycast/api";
import { getMeetupLinks, getMeetupSlug, type Meetup } from "../lib/core";

import {
  formatMeetupLocation,
  formatMeetupRange,
  getMeetupAudienceLabel,
  getMeetupSpeakerNames,
  getMeetupStatusColor,
  getMeetupStatusIcon,
  getMeetupStatusLabel,
} from "../lib/format";

function renderStatusTag(meetup: Meetup) {
  return (
    <Detail.Metadata.TagList title="Status">
      <Detail.Metadata.TagList.Item
        text={getMeetupStatusLabel(meetup)}
        color={getMeetupStatusColor(meetup)}
        icon={getMeetupStatusIcon(meetup)}
      />
    </Detail.Metadata.TagList>
  );
}

function renderListStatusTag(meetup: Meetup) {
  return (
    <List.Item.Detail.Metadata.TagList title="Status">
      <List.Item.Detail.Metadata.TagList.Item
        text={getMeetupStatusLabel(meetup)}
        color={getMeetupStatusColor(meetup)}
        icon={getMeetupStatusIcon(meetup)}
      />
    </List.Item.Detail.Metadata.TagList>
  );
}

function renderSpeakerTagsForDetail(meetup: Meetup) {
  const speakerNames = getMeetupSpeakerNames(meetup);
  if (!speakerNames.length) {
    return null;
  }

  return (
    <Detail.Metadata.TagList title="Speakers">
      {speakerNames.slice(0, 4).map((speaker) => (
        <Detail.Metadata.TagList.Item key={speaker} text={speaker} />
      ))}
      {speakerNames.length > 4 ? (
        <Detail.Metadata.TagList.Item
          text={`+${speakerNames.length - 4} more`}
          color={Color.SecondaryText}
        />
      ) : null}
    </Detail.Metadata.TagList>
  );
}

function renderSpeakerTagsForList(meetup: Meetup) {
  const speakerNames = getMeetupSpeakerNames(meetup);
  if (!speakerNames.length) {
    return null;
  }

  return (
    <List.Item.Detail.Metadata.TagList title="Speakers">
      {speakerNames.slice(0, 4).map((speaker) => (
        <List.Item.Detail.Metadata.TagList.Item key={speaker} text={speaker} />
      ))}
      {speakerNames.length > 4 ? (
        <List.Item.Detail.Metadata.TagList.Item
          text={`+${speakerNames.length - 4} more`}
          color={Color.SecondaryText}
        />
      ) : null}
    </List.Item.Detail.Metadata.TagList>
  );
}

function renderSponsorTagsForDetail(meetup: Meetup) {
  if (!meetup.sponsors.length) {
    return null;
  }

  return (
    <Detail.Metadata.TagList title="Sponsors">
      {meetup.sponsors.slice(0, 4).map((sponsor) => (
        <Detail.Metadata.TagList.Item key={sponsor.name} text={sponsor.name} />
      ))}
      {meetup.sponsors.length > 4 ? (
        <Detail.Metadata.TagList.Item
          text={`+${meetup.sponsors.length - 4} more`}
          color={Color.SecondaryText}
        />
      ) : null}
    </Detail.Metadata.TagList>
  );
}

function renderSponsorTagsForList(meetup: Meetup) {
  if (!meetup.sponsors.length) {
    return null;
  }

  return (
    <List.Item.Detail.Metadata.TagList title="Sponsors">
      {meetup.sponsors.slice(0, 4).map((sponsor) => (
        <List.Item.Detail.Metadata.TagList.Item
          key={sponsor.name}
          text={sponsor.name}
        />
      ))}
      {meetup.sponsors.length > 4 ? (
        <List.Item.Detail.Metadata.TagList.Item
          text={`+${meetup.sponsors.length - 4} more`}
          color={Color.SecondaryText}
        />
      ) : null}
    </List.Item.Detail.Metadata.TagList>
  );
}

export function MeetupDetailMetadata({ meetup }: { meetup: Meetup }) {
  const audience = getMeetupAudienceLabel(meetup);
  const links = getMeetupLinks(meetup);

  return (
    <Detail.Metadata>
      {renderStatusTag(meetup)}
      <Detail.Metadata.Label title="When" text={formatMeetupRange(meetup)} />
      <Detail.Metadata.Label
        title="Where"
        text={formatMeetupLocation(meetup)}
      />
      {audience ? (
        <Detail.Metadata.Label title="Attendance" text={audience} />
      ) : null}
      <Detail.Metadata.Label title="Slug" text={getMeetupSlug(meetup)} />
      <Detail.Metadata.Separator />
      {renderSpeakerTagsForDetail(meetup)}
      {renderSponsorTagsForDetail(meetup)}
      {links.meetup ? (
        <Detail.Metadata.Link
          title="Meetup Page"
          target={links.meetup}
          text="Open"
        />
      ) : null}
      {links.rsvp ? (
        <Detail.Metadata.Link title="RSVP" target={links.rsvp} text="Open" />
      ) : meetup.acceptingRsvp ? (
        <Detail.Metadata.Label title="RSVP" text="Open on website" />
      ) : null}
      {links.map ? (
        <Detail.Metadata.Link title="Map" target={links.map} text="Open" />
      ) : null}
      {links.parking ? (
        <Detail.Metadata.Link
          title="Parking"
          target={links.parking}
          text="Open"
        />
      ) : null}
    </Detail.Metadata>
  );
}

export function MeetupListMetadata({ meetup }: { meetup: Meetup }) {
  const audience = getMeetupAudienceLabel(meetup);
  const links = getMeetupLinks(meetup);

  return (
    <List.Item.Detail.Metadata>
      {renderListStatusTag(meetup)}
      <List.Item.Detail.Metadata.Label
        title="When"
        text={formatMeetupRange(meetup)}
      />
      <List.Item.Detail.Metadata.Label
        title="Where"
        text={formatMeetupLocation(meetup)}
      />
      {audience ? (
        <List.Item.Detail.Metadata.Label title="Attendance" text={audience} />
      ) : null}
      {links.rsvp ? (
        <List.Item.Detail.Metadata.Link
          title="RSVP"
          target={links.rsvp}
          text="Open"
        />
      ) : meetup.acceptingRsvp ? (
        <List.Item.Detail.Metadata.Label title="RSVP" text="Open on website" />
      ) : null}
      <List.Item.Detail.Metadata.Separator />
      {renderSpeakerTagsForList(meetup)}
      {renderSponsorTagsForList(meetup)}
    </List.Item.Detail.Metadata>
  );
}
