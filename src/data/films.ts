export type Film = {
  id: string
  title: string
  subtitle?: string
  year?: number
  runtime?: string
  description: string
  href: string
  palette: { base: string; ink: string; accent: string }
  isPlaceholder?: boolean
}

export const films: Film[] = [
  {
    id: 'we-are-as-gods',
    title: 'We Are As Gods',
    subtitle: 'A film about Stewart Brand',
    year: 2020,
    runtime: '1h 34m',
    description:
      'Placeholder synopsis. Reference copy was not retrievable in this environment; length and rhythm are preserved so layout and interaction match.',
    href: 'https://press.stripe.com/we-are-as-gods',
    palette: { base: '#3f5b4a', ink: '#f1ece1', accent: '#c9a227' },
    isPlaceholder: true,
  },
  {
    id: 'beneath-the-surface',
    title: 'Beneath the Surface',
    subtitle: 'A film about the people who keep things running',
    runtime: '22m',
    description:
      'Placeholder synopsis. Reference copy was not retrievable in this environment; length and rhythm are preserved so layout and interaction match.',
    href: 'https://press.stripe.com/beneath-the-surface',
    palette: { base: '#1f4d6b', ink: '#eaf1f5', accent: '#7fb2cf' },
    isPlaceholder: true,
  },
]
