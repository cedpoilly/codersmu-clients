export interface MeetupSpeaker {
  name: string;
  githubUsername?: string;
}

export interface MeetupSession {
  title: string;
  description?: string;
  speakers: MeetupSpeaker[];
}

export interface MeetupSponsor {
  name: string;
  website?: string;
}

export interface MeetupLinks {
  meetup?: string;
  rsvp?: string;
  map?: string;
  parking?: string;
}

export interface MeetupLocation {
  name: string;
  address?: string;
  city?: string;
}

export interface Meetup {
  id: string;
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "scheduled" | "ongoing" | "completed";
  location: MeetupLocation;
  speakers: MeetupSpeaker[];
  sessions: MeetupSession[];
  sponsors: MeetupSponsor[];
  links: MeetupLinks;
}
