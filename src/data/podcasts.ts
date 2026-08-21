export type PodcastEpisode = {
  id: string
  title: string
  guest?: string
  description: string
  href: string
  isPlaceholder?: boolean
}

export const podcast = {
  title: 'Stripe Press Podcast',
  description:
    'Conversations with the authors of Stripe Press books about the ideas behind them.',
  href: 'https://press.stripe.com/podcast',
  isPlaceholder: true,
}

export const episodes: PodcastEpisode[] = [
  {
    id: 'ep-placeholder-1',
    title: 'Placeholder episode one',
    guest: 'Author name pending',
    description:
      'Placeholder episode copy — reference content was not retrievable in this environment.',
    href: 'https://press.stripe.com/podcast',
    isPlaceholder: true,
  },
  {
    id: 'ep-placeholder-2',
    title: 'Placeholder episode two',
    guest: 'Author name pending',
    description:
      'Placeholder episode copy — reference content was not retrievable in this environment.',
    href: 'https://press.stripe.com/podcast',
    isPlaceholder: true,
  },
  {
    id: 'ep-placeholder-3',
    title: 'Placeholder episode three',
    guest: 'Author name pending',
    description:
      'Placeholder episode copy — reference content was not retrievable in this environment.',
    href: 'https://press.stripe.com/podcast',
    isPlaceholder: true,
  },
]
