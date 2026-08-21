/**
 * Central book catalogue. Content is data, never embedded in visual components.
 *
 * Provenance:
 *  - `title`, `author`, `year` are factual catalogue metadata.
 *  - `slug` mirrors press.stripe.com's `/<slug>` routing. Slugs marked `slugVerified`
 *    were confirmed; the rest follow the same observed convention.
 *  - `description`, `praise`, `authorBio` could not be retrieved from the reference in
 *    this environment, so they are PLACEHOLDER copy, flagged with `isPlaceholder` and
 *    surfaced as such in the UI. Nothing is invented and attributed to a real person.
 *  - `cover`/`spine`/`back` are optional URLs. When absent, artwork is generated from
 *    `palette` (see src/textures/coverArt.ts). Drop real files into /public/books/ and
 *    set these fields to swap them in with no component changes.
 */

export type Praise = {
  quote: string
  author: string
  role?: string
}

export type PurchaseLink = {
  label: string
  href: string
}

export type BookPalette = {
  /** Cover ground. */
  base: string
  /** Ink used for title/author and the cover mark. */
  ink: string
  /** Secondary graphic colour. */
  accent: string
  /** Spine ground; defaults to `base` when omitted. */
  spine?: string
}

export type Book = {
  id: string
  slug: string
  slugVerified?: boolean
  title: string
  subtitle?: string
  author: string
  year?: number
  /** Drives book depth — a real catalogue value, so books differ physically. */
  pageCount: number
  palette: BookPalette
  /** Optional artwork overrides. Generated procedurally when absent. */
  cover?: string
  spine?: string
  back?: string
  description: string
  authorBio?: string
  praise?: Praise[]
  purchaseLinks?: PurchaseLink[]
  /** True while long-form copy is placeholder rather than reference copy. */
  isPlaceholder?: boolean
}

const PLACEHOLDER =
  'Placeholder description. The reference copy for this title was not retrievable in this environment, so this text stands in at the same length and rhythm to preserve layout and interaction behaviour. Replace via src/data/books.ts.'

const buy = (slug: string): PurchaseLink[] => [
  { label: 'Stripe Press', href: `https://press.stripe.com/${slug}` },
]

export const books: Book[] = [
  {
    id: 'poor-charlies-almanack',
    slug: 'poor-charlies-almanack',
    title: "Poor Charlie's Almanack",
    subtitle: 'The Essential Wit and Wisdom of Charles T. Munger',
    author: 'Charles T. Munger',
    year: 2023,
    pageCount: 512,
    palette: { base: '#b8342f', ink: '#f6e9d8', accent: '#e0a93c', spine: '#a12b27' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('poor-charlies-almanack'),
  },
  {
    id: 'maintenance-part-one',
    slug: 'maintenance-part-one',
    slugVerified: true,
    title: 'Maintenance',
    subtitle: 'Of Everything, Part One',
    author: 'Stewart Brand',
    year: 2025,
    pageCount: 304,
    palette: { base: '#3f5b4a', ink: '#f1ece1', accent: '#c9a227', spine: '#354d3f' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('maintenance-part-one'),
  },
  {
    id: 'origins-of-efficiency',
    slug: 'origins-of-efficiency',
    slugVerified: true,
    title: 'The Origins of Efficiency',
    author: 'Brian Potter',
    year: 2025,
    pageCount: 352,
    palette: { base: '#c9c2b2', ink: '#241d1a', accent: '#9d3b2b', spine: '#bdb5a3' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('origins-of-efficiency'),
  },
  {
    id: 'scaling-era',
    slug: 'scaling-era',
    title: 'The Scaling Era',
    subtitle: 'An Oral History of AI, 2019–2025',
    author: 'Dwarkesh Patel',
    year: 2025,
    pageCount: 480,
    palette: { base: '#1f4d6b', ink: '#eaf1f5', accent: '#7fb2cf', spine: '#1a4159' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('scaling-era'),
  },
  {
    id: 'boom',
    slug: 'boom',
    title: 'Boom',
    subtitle: 'Bubbles and the End of Stagnation',
    author: 'Byrne Hobart and Tobias Huber',
    year: 2024,
    pageCount: 288,
    palette: { base: '#e0533a', ink: '#fdf3e6', accent: '#f2b134', spine: '#c9452f' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('boom'),
  },
  {
    id: 'scaling-people',
    slug: 'scaling-people',
    title: 'Scaling People',
    subtitle: 'Tactics for Management and Company Building',
    author: 'Claire Hughes Johnson',
    year: 2023,
    pageCount: 480,
    palette: { base: '#2f4858', ink: '#eef2f4', accent: '#8fb3a4', spine: '#283e4b' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('scaling-people'),
  },
  {
    id: 'pieces-of-the-action',
    slug: 'pieces-of-the-action',
    title: 'Pieces of the Action',
    author: 'Vannevar Bush',
    year: 2023,
    pageCount: 400,
    palette: { base: '#8a5a3b', ink: '#f7ecdd', accent: '#d9a441', spine: '#754c32' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('pieces-of-the-action'),
  },
  {
    id: 'flying-car',
    slug: 'flying-car',
    title: 'Where Is My Flying Car?',
    author: 'J. Storrs Hall',
    year: 2021,
    pageCount: 392,
    palette: { base: '#d8d2c4', ink: '#1e2a33', accent: '#c2452d', spine: '#cbc4b4' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('flying-car'),
  },
  {
    id: 'the-big-score',
    slug: 'the-big-score',
    title: 'The Big Score',
    subtitle: 'The Billion-Dollar Story of Silicon Valley',
    author: 'Michael S. Malone',
    year: 2021,
    pageCount: 480,
    palette: { base: '#1d2a4a', ink: '#f0eee7', accent: '#c8a04b', spine: '#18233e' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('the-big-score'),
  },
  {
    id: 'scientific-freedom',
    slug: 'scientific-freedom',
    title: 'Scientific Freedom',
    subtitle: 'The Elixir of Civilization',
    author: 'Donald W. Braben',
    year: 2020,
    pageCount: 256,
    palette: { base: '#f0e9dc', ink: '#2b2320', accent: '#3f6d5a', spine: '#e6ded0' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('scientific-freedom'),
  },
  {
    id: 'working-in-public',
    slug: 'working-in-public',
    title: 'Working in Public',
    subtitle: 'The Making and Maintenance of Open Source Software',
    author: 'Nadia Eghbal',
    year: 2020,
    pageCount: 256,
    palette: { base: '#e8b33c', ink: '#26201a', accent: '#2f5d50', spine: '#d9a531' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('working-in-public'),
  },
  {
    id: 'the-art-of-doing-science-and-engineering',
    slug: 'the-art-of-doing-science-and-engineering',
    title: 'The Art of Doing Science and Engineering',
    subtitle: 'Learning to Learn',
    author: 'Richard Hamming',
    year: 2020,
    pageCount: 432,
    palette: { base: '#5b4a7a', ink: '#f2eef7', accent: '#c9b7e0', spine: '#4e3f68' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('the-art-of-doing-science-and-engineering'),
  },
  {
    id: 'the-making-of-prince-of-persia',
    slug: 'the-making-of-prince-of-persia',
    title: 'The Making of Prince of Persia',
    subtitle: 'Journals 1985–1993',
    author: 'Jordan Mechner',
    year: 2020,
    pageCount: 336,
    palette: { base: '#1c3f5c', ink: '#f4ead6', accent: '#e0a93c', spine: '#17344c' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('the-making-of-prince-of-persia'),
  },
  {
    id: 'get-together',
    slug: 'get-together',
    title: 'Get Together',
    subtitle: 'How to Build a Community With Your People',
    author: 'Bailey Richardson, Kevin Huynh, and Kai Elmer Sotto',
    year: 2019,
    pageCount: 192,
    palette: { base: '#e07a5f', ink: '#fdf4ec', accent: '#3d5a6c', spine: '#cd6b51' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('get-together'),
  },
  {
    id: 'an-elegant-puzzle',
    slug: 'an-elegant-puzzle',
    title: 'An Elegant Puzzle',
    subtitle: 'Systems of Engineering Management',
    author: 'Will Larson',
    year: 2019,
    pageCount: 280,
    palette: { base: '#2e6b62', ink: '#eff6f3', accent: '#d9b44a', spine: '#275c54' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('an-elegant-puzzle'),
  },
  {
    id: 'revolt-of-the-public',
    slug: 'revolt-of-the-public',
    title: 'The Revolt of the Public',
    subtitle: 'And the Crisis of Authority in the New Millennium',
    author: 'Martin Gurri',
    year: 2018,
    pageCount: 464,
    palette: { base: '#b03a2e', ink: '#f7ece2', accent: '#2b2320', spine: '#983228' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('revolt-of-the-public'),
  },
  {
    id: 'stubborn-attachments',
    slug: 'stubborn-attachments',
    title: 'Stubborn Attachments',
    subtitle: 'A Vision for a Society of Free, Prosperous, and Responsible Individuals',
    author: 'Tyler Cowen',
    year: 2018,
    pageCount: 160,
    palette: { base: '#3c6e9c', ink: '#f1f5f8', accent: '#e8c15c', spine: '#345f88' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('stubborn-attachments'),
  },
  {
    id: 'dream-machine',
    slug: 'dream-machine',
    title: 'The Dream Machine',
    author: 'M. Mitchell Waldrop',
    year: 2018,
    pageCount: 528,
    palette: { base: '#20303f', ink: '#e9eef2', accent: '#5f97b8', spine: '#1b2836' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('dream-machine'),
  },
  {
    id: 'high-growth-handbook',
    slug: 'high-growth-handbook',
    title: 'High Growth Handbook',
    subtitle: 'Scaling Startups From 10 to 10,000 People',
    author: 'Elad Gil',
    year: 2018,
    pageCount: 352,
    palette: { base: '#d94f3d', ink: '#fdf2e9', accent: '#1f3a4d', spine: '#c34435' },
    description: PLACEHOLDER,
    isPlaceholder: true,
    purchaseLinks: buy('high-growth-handbook'),
  },
]

export const bookBySlug = (slug: string | undefined): Book | undefined =>
  slug ? books.find((b) => b.slug === slug) : undefined

export const bookIndex = (slug: string | undefined): number =>
  slug ? books.findIndex((b) => b.slug === slug) : -1

export const neighbours = (slug: string) => {
  const i = bookIndex(slug)
  return {
    previous: i > 0 ? books[i - 1] : undefined,
    next: i >= 0 && i < books.length - 1 ? books[i + 1] : undefined,
  }
}
