import { getMeetupSlug } from '../meetup-derived'
import type { Meetup, MeetupProvider } from '../types'

const MOCK_MEETUPS: Meetup[] = [
  {
    id: '2026-04-09-graphql-and-observability',
    title: 'GraphQL in Production + Practical Observability',
    description: 'Two talks on keeping APIs fast, measurable, and understandable as a team scales.',
    date: '2026-04-09',
    startTime: '18:30',
    endTime: '21:00',
    venue: 'The Hive Ebene',
    location: 'Vivea Business Park, Moka Road, Ebene',
    status: 'published',
    photos: [],
    sessions: [
      {
        id: 'graphql-session',
        title: 'GraphQL in Production',
        description: null,
        order: 1,
        speakers: [
          {
            id: 'aisha-rajcoomar',
            name: 'Aisha Rajcoomar',
            githubUsername: null,
            avatarUrl: null,
            featured: 1,
          },
          {
            id: 'noah-bholah',
            name: 'Noah Bholah',
            githubUsername: null,
            avatarUrl: null,
            featured: 0,
          },
        ],
      },
    ],
    sponsors: [],
    acceptingRsvp: 0,
    seatsAvailable: null,
  },
  {
    id: '2026-02-13-typescript-tooling',
    title: 'TypeScript Tooling at Scale',
    description: 'How local teams standardize DX, builds, and release workflows across TypeScript projects.',
    date: '2026-02-13',
    startTime: '18:30',
    endTime: '21:00',
    venue: 'La Turbine',
    location: 'Vivea Business Park, St Pierre, Moka',
    status: 'published',
    photos: [],
    sessions: [
      {
        id: 'typescript-session',
        title: 'TypeScript Tooling at Scale',
        description: null,
        order: 1,
        speakers: [
          {
            id: 'cindy-jeeha',
            name: 'Cindy Jeeha',
            githubUsername: null,
            avatarUrl: null,
            featured: 1,
          },
        ],
      },
    ],
    sponsors: [],
    acceptingRsvp: 0,
    seatsAvailable: null,
  },
  {
    id: '2025-11-27-modern-css',
    title: 'Modern CSS Patterns',
    description: 'Layout techniques, container queries, and motion that survive real product constraints.',
    date: '2025-11-27',
    startTime: '18:30',
    endTime: '21:00',
    venue: 'Rocket Labs Mauritius',
    location: '10th Floor, NexSky Building, Ebene',
    status: 'published',
    photos: [],
    sessions: [
      {
        id: 'css-session',
        title: 'Modern CSS Patterns',
        description: null,
        order: 1,
        speakers: [
          {
            id: 'ritesh-jugurnauth',
            name: 'Ritesh Jugurnauth',
            githubUsername: null,
            avatarUrl: null,
            featured: 1,
          },
        ],
      },
    ],
    sponsors: [],
    acceptingRsvp: 0,
    seatsAvailable: null,
  },
]

export class MockMeetupProvider implements MeetupProvider {
  async listMeetups(): Promise<Meetup[]> {
    return MOCK_MEETUPS
  }

  async getMeetupBySlug(slug: string): Promise<Meetup | undefined> {
    return MOCK_MEETUPS.find((meetup) => getMeetupSlug(meetup) === slug)
  }
}
