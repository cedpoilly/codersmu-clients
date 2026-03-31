import type { Meetup, MeetupProvider } from '../types'

const MOCK_MEETUPS: Meetup[] = [
  {
    id: '2026-04-09-graphql-and-observability',
    slug: 'graphql-and-observability',
    title: 'GraphQL in Production + Practical Observability',
    summary: 'Two talks on keeping APIs fast, measurable, and understandable as a team scales.',
    startsAt: '2026-04-09T14:30:00Z',
    endsAt: '2026-04-09T17:00:00Z',
    timezone: 'Indian/Mauritius',
    status: 'scheduled',
    location: {
      name: 'The Hive Ebene',
      address: 'Vivea Business Park, Moka Road',
      city: 'Ebene',
    },
    speakers: [
      {
        name: 'Aisha Rajcoomar',
        title: 'Senior Software Engineer',
      },
      {
        name: 'Noah Bholah',
        title: 'Platform Engineer',
      },
    ],
    sessions: [],
    sponsors: [],
    tags: ['graphql', 'observability', 'backend'],
    links: {},
  },
  {
    id: '2026-02-13-typescript-tooling',
    slug: 'typescript-tooling-at-scale',
    title: 'TypeScript Tooling at Scale',
    summary: 'How local teams standardize DX, builds, and release workflows across TypeScript projects.',
    startsAt: '2026-02-13T14:30:00Z',
    endsAt: '2026-02-13T17:00:00Z',
    timezone: 'Indian/Mauritius',
    status: 'completed',
    location: {
      name: 'La Turbine',
      address: 'Vivea Business Park, St Pierre',
      city: 'Moka',
    },
    speakers: [
      {
        name: 'Cindy Jeeha',
        title: 'Developer Experience Lead',
      },
    ],
    sessions: [],
    sponsors: [],
    tags: ['typescript', 'tooling', 'dx'],
    links: {
      recording: 'https://example.com/videos/typescript-tooling-at-scale',
      slides: 'https://example.com/slides/typescript-tooling-at-scale',
    },
  },
  {
    id: '2025-11-27-modern-css',
    slug: 'modern-css-patterns',
    title: 'Modern CSS Patterns',
    summary: 'Layout techniques, container queries, and motion that survive real product constraints.',
    startsAt: '2025-11-27T14:30:00Z',
    endsAt: '2025-11-27T17:00:00Z',
    timezone: 'Indian/Mauritius',
    status: 'completed',
    location: {
      name: 'Rocket Labs Mauritius',
      address: '10th Floor, NexSky Building',
      city: 'Ebene',
    },
    speakers: [
      {
        name: 'Ritesh Jugurnauth',
        title: 'Frontend Engineer',
      },
    ],
    sessions: [],
    sponsors: [],
    tags: ['css', 'frontend', 'design-systems'],
    links: {
      recording: 'https://example.com/videos/modern-css-patterns',
    },
  },
]

export class MockMeetupProvider implements MeetupProvider {
  async listMeetups(): Promise<Meetup[]> {
    return MOCK_MEETUPS
  }

  async getMeetupBySlug(slug: string): Promise<Meetup | undefined> {
    return MOCK_MEETUPS.find((meetup) => meetup.slug === slug)
  }
}
