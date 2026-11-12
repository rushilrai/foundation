import { useMemo, useState } from 'react'

import { AddLinkButton } from '@/components/AddLinkButton'
import { AnswerCard } from '@/components/AnswerCard'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { EmptyState, InlineError } from '@/components/EmptyState'
import { tagColorIndex } from '@/components/lib/tags'
import { LibraryHeader } from '@/components/LibraryHeader'
import {
  LinkPreviewCard,
  LinkPreviewCardSkeleton,
} from '@/components/LinkPreviewCard'
import { LinkRow, LinkRowSkeleton } from '@/components/LinkRow'
import { MonthHeading } from '@/components/MonthHeading'
import { SearchField } from '@/components/SearchField'
import { Tag } from '@/components/Tag'
import { TagFilterBar } from '@/components/TagFilterBar'
import { TagPicker } from '@/components/TagPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MESSAGES } from '@/modules/link/errors'
import { countTags, groupByMonth } from '@/modules/link/utils'

// Dev-only gallery of the UI kit with realistic sample data. Not linked from the app.

// Shaped like a `links` document, so rows take it as they will take real ones.
type SampleLink = {
  id: string
  title: string
  url: string
  domain: string
  summary?: string
  summaryStatus: 'pending' | 'ready' | 'failed'
  description?: string
  image?: string
  tags: string[]
  savedAt: number
}

// Fixed, so the server render and hydration agree on every date.
const NOW = Date.UTC(2026, 10, 12)
const TIME_ZONE = 'UTC'
const DATES = { now: NOW, timeZone: TIME_ZONE }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const LINKS: SampleLink[] = [
  {
    id: 'bakery',
    title: 'Theobroma Bakery & Patisserie, Colaba Causeway',
    url: 'https://maps.google.com/?cid=1234567890',
    domain: 'maps.google.com',
    summaryStatus: 'ready',
    summary:
      'The original Theobroma: dutch truffle cake, brownies, and a small café that opens at 8.',
    description:
      'Bakery · Colaba Causeway, Mumbai · Open 8 am – 11 pm · ★ 4.5 (12,804)',
    image: 'https://picsum.photos/seed/webcase-bakery/1200/675',
    tags: ['places', 'restaurants', 'mumbai', 'bakery'],
    savedAt: Date.UTC(2026, 10, 10, 9, 30),
  },
  {
    id: 'router',
    title:
      'TanStack/router: Fully typesafe router for React, with state management',
    url: 'https://github.com/TanStack/router',
    domain: 'github.com',
    summaryStatus: 'ready',
    summary:
      'Type-safe routing with search-param state, loaders and caching built in; also powers TanStack Start.',
    description:
      '🤖 A fully type-safe React router with built-in data fetching, stale-while-revalidate caching and first-class search-param APIs.',
    image: 'https://example.invalid/og-image-that-fails.png',
    tags: ['dev', 'react'],
    savedAt: Date.UTC(2026, 10, 8, 18, 5),
  },
  {
    id: 'reddit',
    title: 'Where would you take a first-time visitor for dinner in Bandra?',
    url: 'https://www.reddit.com/r/mumbai/comments/1abcde/',
    domain: 'reddit.com',
    summaryStatus: 'pending',
    tags: ['restaurants', 'mumbai'],
    savedAt: Date.UTC(2026, 10, 6, 21, 40),
  },
  {
    id: 'hairlines',
    title:
      'The unreasonable effectiveness of hairlines: notes on typographic restraint in interface design, with examples from seventy years of print',
    url: 'https://longform.thedesignquarterlyjournalofeverything.co.uk/2026/hairlines',
    domain: 'longform.thedesignquarterlyjournalofeverything.co.uk',
    summaryStatus: 'ready',
    summary:
      'An essay arguing that thin rules, generous margins and two typefaces do more for hierarchy than colour or boxes ever do, with case studies from Swiss posters, mid-century annual reports and today’s best reading apps.',
    tags: [
      'ui',
      'design',
      'reading',
      'typography',
      'longreads',
      'print',
      'history',
      'swiss',
    ],
    savedAt: Date.UTC(2026, 9, 28, 7, 15),
  },
  {
    id: 'pocket',
    title: 'Pocket is shutting down. Here’s what to do with your saves',
    url: 'https://www.theverge.com/2025/pocket-shutting-down',
    domain: 'theverge.com',
    summaryStatus: 'failed',
    tags: ['reading'],
    savedAt: Date.UTC(2026, 9, 2, 12, 0),
  },
  {
    id: 'canteen',
    title: 'The Bombay Canteen',
    url: 'https://maps.google.com/?cid=987654321',
    domain: 'maps.google.com',
    summaryStatus: 'ready',
    summary:
      'Regional Indian small plates in Lower Parel; book ahead for weekends.',
    tags: ['places', 'restaurants', 'mumbai'],
    savedAt: Date.UTC(2025, 11, 14, 20, 0),
  },
  {
    id: 'unbroken',
    title:
      'https://docs.example.com/api/v2/reference/endpoints/links/create-a-link-with-tags-and-metadata-and-a-very-long-slug',
    url: 'https://docs.example.com/api/v2/reference/endpoints/links/create-a-link-with-tags-and-metadata-and-a-very-long-slug',
    domain: 'docs.example.com',
    summaryStatus: 'ready',
    summary:
      'Reference:aVeryLongIdentifierWithoutAnySpacesThatWouldOtherwiseOverflowTheColumnOnAPhone.',
    tags: ['dev'],
    savedAt: Date.UTC(2025, 11, 2, 8, 0),
  },
]

// 70 tags, as a long-time user might have.
const TAG_NAMES = [
  'places',
  'restaurants',
  'dev',
  'ui',
  'mumbai',
  'reading',
  'bakery',
  'design',
  'react',
  'typography',
  'longreads',
  'travel',
  'coffee',
  'recipes',
  'music',
  'film',
  'books',
  'tools',
  'ai',
  'convex',
  'css',
  'typescript',
  'goa',
  'bangalore',
  'tokyo',
  'lisbon',
  'hiking',
  'gear',
  'gifts',
  'home',
  'furniture',
  'lighting',
  'plants',
  'fitness',
  'running',
  'health',
  'money',
  'investing',
  'tax',
  'career',
  'interviews',
  'writing',
  'productivity',
  'apps',
  'ios',
  'android',
  'photography',
  'cameras',
  'art',
  'museums',
  'architecture',
  'cities',
  'maps',
  'podcasts',
  'video',
  'youtube',
  'kids',
  'school',
  'parenting',
  'cars',
  'cycling',
  'climate',
  'science',
  'history',
  'politics',
  'news',
  'humour',
  'games',
  'fonts',
  'later',
]

const TAG_COUNTS = TAG_NAMES.map((tag, index) => ({
  tag,
  count: Math.round(
    [116, 81, 34, 26, 58, 40, 9][index] ?? Math.max(1, 30 - index / 3),
  ),
}))

// "Dev" and " Mumbai" normalise to tags that may already be chosen.
const SUGGESTIONS = ['bakery', ' Mumbai', 'cafe', 'dessert', 'Dev']

export const KitScreen = () => {
  return (
    <main className="page-column fab-clearance">
      <HomePreview />

      <KitSection title="Search">
        <SearchDemo initial="" />
        <SearchDemo initial="bakeries near colaba" />
        <SearchDemo initial="where did I save that bandra place?" busy />
        <SearchDemo initial="disabled while offline" disabled />
      </KitSection>

      <KitSection title="Tag filter">
        <FilterDemo />
      </KitSection>

      <KitSection title="Tags">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TAG_NAMES.slice(0, 24).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1">
              <Tag name={tag} />
              <span className="font-mono text-3xs text-faint-foreground">
                {tagColorIndex(tag) + 1}
              </span>
            </span>
          ))}
        </div>
      </KitSection>

      <KitSection title="Link rows">
        <LinkRowsDemo />
      </KitSection>

      <KitSection title="Link preview">
        <div className="flex flex-col gap-4">
          <LinkPreviewCard
            title={LINKS[0].title}
            domain={LINKS[0].domain}
            description={LINKS[0].description}
            image={LINKS[0].image}
          />
          <Caption>Image failed to load: dropped, no gap</Caption>
          <LinkPreviewCard
            title={LINKS[1].title}
            domain={LINKS[1].domain}
            description={LINKS[1].description}
            image={LINKS[1].image}
          />
          <Caption>Loading</Caption>
          <LinkPreviewCardSkeleton />
        </div>
      </KitSection>

      <KitSection title="Tag picker">
        <TagPickerDemo />
        <div className="mt-8">
          <TagPicker
            value={['bakery']}
            onChange={() => undefined}
            suggestionsLoading
            label="Tags (suggestions loading)"
          />
        </div>
        <div className="mt-8">
          <TagPicker
            value={['places', 'restaurants']}
            onChange={() => undefined}
            suggestions={SUGGESTIONS}
            disabled
            label="Tags (disabled)"
          />
        </div>
        <div className="mt-8">
          <TagPicker
            value={['places']}
            onChange={() => undefined}
            error="Couldn’t save the tags. Try again."
            label="Tags (error)"
          />
        </div>
        <FullTagPickerDemo />
      </KitSection>

      <KitSection title="Answer">
        <div className="flex flex-col gap-4">
          <AnswerCard
            question="where did I save that bandra place?"
            answer="You saved a Reddit thread on 6 November about dinner in Bandra; the top picks were Bastian and Candies."
            onDismiss={() => undefined}
          />
          <AnswerCard loading question="best bakery in colaba?" />
          <AnswerCard
            question="what did I save about tokyo?"
            error="You’ve asked a lot today. Try again tomorrow."
            onDismiss={() => undefined}
          />
        </div>
      </KitSection>

      <KitSection title="Empty and error">
        <EmptyState
          title="No links yet."
          description="Save something from your browser’s share sheet, or add one here."
          action={<Button className="h-11 px-5">Add your first link</Button>}
          className="py-10"
        />
        <EmptyState
          title="Nothing tagged dessert."
          className="border-t py-10"
        />
        <EmptyState
          tone="error"
          title="Couldn’t load your links."
          description="Check your connection and try again."
          action={
            <Button variant="outline" className="h-11 px-5">
              Try again
            </Button>
          }
          className="border-t py-10"
        />
        <div className="flex flex-col gap-2 border-t pt-6">
          <Input placeholder="https://" defaultValue="not a url" aria-invalid />
          <InlineError>{MESSAGES.INVALID_URL}</InlineError>
        </div>
      </KitSection>

      <KitSection title="Delete">
        <Caption>
          Succeeds: resolves to {'{ success: true }'}, then closes
        </Caption>
        <ConfirmDelete
          label="Delete link (succeeds)"
          onConfirm={() => wait(900).then(() => ({ success: true }))}
        />
        <Caption>
          Fails: resolves to {'{ error }'}, stays open with an error
        </Caption>
        <ConfirmDelete
          label="Delete link (fails)"
          onConfirm={() => wait(900).then(() => ({ error: 'NOT_FOUND' }))}
        />
        <Caption>Controlled: the parent owns open, pending and error</Caption>
        <ControlledDeleteDemo />
      </KitSection>
    </main>
  )
}

const HomePreview = () => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)

  const visible = useMemo(
    () =>
      LINKS.filter(
        (link) =>
          (!active || link.tags.includes(active)) &&
          (!query || link.title.toLowerCase().includes(query.toLowerCase())),
      ),
    [active, query],
  )
  const groups = groupByMonth(visible, (link) => link.savedAt, DATES)

  const ask = () => {
    if (!query.trim()) return
    setAnswer(null)
    setAsking(true)
    setTimeout(() => {
      setAsking(false)
      setAnswer(
        'Two Colaba spots are saved: Theobroma on the Causeway, and a Reddit thread that recommends it too.',
      )
    }, 1400)
  }

  return (
    <section aria-label="Home preview">
      <LibraryHeader count={246} />

      <SearchField
        className="mt-4"
        value={query}
        onChange={(value) => {
          setQuery(value)
          setAnswer(null)
        }}
        onSubmit={ask}
        busy={asking}
      />

      <TagFilterBar
        className="mt-1"
        tags={TAG_COUNTS}
        active={active}
        onChange={setActive}
      />

      {answer && (
        <AnswerCard
          className="mt-4"
          question={query}
          answer={answer}
          onDismiss={() => setAnswer(null)}
        />
      )}

      {groups.length === 0 ? (
        <EmptyState
          title={active ? `Nothing tagged ${active}.` : 'No matches.'}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <MonthHeading>{group.label}</MonthHeading>
            {group.items.map((link) => (
              <LinkRow
                key={link.id}
                {...link}
                {...DATES}
                onSelect={() => undefined}
                onTagSelect={setActive}
              />
            ))}
          </section>
        ))
      )}

      <AddLinkButton onClick={() => undefined} />
    </section>
  )
}

const SearchDemo = ({
  initial,
  busy = false,
  disabled = false,
}: {
  initial: string
  busy?: boolean
  disabled?: boolean
}) => {
  const [value, setValue] = useState(initial)
  return (
    <SearchField
      value={value}
      onChange={setValue}
      busy={busy}
      disabled={disabled}
    />
  )
}

const LinkRowsDemo = () => {
  const [lastTap, setLastTap] = useState('nothing yet')
  return (
    <div>
      <p
        className="mb-2 font-mono text-2xs text-faint-foreground"
        data-testid="row-tap"
      >
        last tap: {lastTap}
      </p>
      <MonthHeading className="pt-0">November</MonthHeading>
      <LinkRow
        {...LINKS[0]}
        {...DATES}
        titleOpensLink
        onSelect={() => setLastTap(`row ${LINKS[0].id}`)}
        onTagSelect={(tag) => setLastTap(`tag ${tag}`)}
      />
      <LinkRow
        {...LINKS[3]}
        {...DATES}
        onSelect={() => setLastTap(`row ${LINKS[3].id}`)}
        onTagSelect={(tag) => setLastTap(`tag ${tag}`)}
      />
      <LinkRow
        {...LINKS[2]}
        {...DATES}
        onSelect={() => setLastTap(`row ${LINKS[2].id}`)}
      />
      <LinkRow {...LINKS[4]} {...DATES} />
      <LinkRow
        {...LINKS[6]}
        {...DATES}
        onSelect={() => setLastTap(`row ${LINKS[6].id}`)}
      />
      <LinkRowSkeleton />
      <LinkRowSkeleton />
    </div>
  )
}

const FilterDemo = () => {
  const [active, setActive] = useState<string | null>('dev')
  return (
    <TagFilterBar
      tags={countTags(LINKS)}
      active={active}
      onChange={setActive}
    />
  )
}

const TagPickerDemo = () => {
  const [tags, setTags] = useState(['places', 'restaurants', 'dev'])
  return (
    <>
      <TagPicker
        value={tags}
        onChange={setTags}
        suggestions={SUGGESTIONS}
        allTags={TAG_NAMES}
      />
      <p
        className="mt-4 font-mono text-2xs text-faint-foreground"
        data-testid="tag-picker-value"
      >
        value: {JSON.stringify(tags)}
      </p>
    </>
  )
}

const FullTagPickerDemo = () => {
  const [tags, setTags] = useState(TAG_NAMES.slice(0, 20))
  return (
    <div className="mt-8">
      <TagPicker
        value={tags}
        onChange={setTags}
        suggestions={SUGGESTIONS}
        allTags={TAG_NAMES}
        label={`Tags (${tags.length} of 20)`}
      />
    </div>
  )
}

const ControlledDeleteDemo = () => {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  return (
    <ConfirmDelete
      label="Delete link (fails once, then succeeds)"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
      pending={pending}
      error={error}
      onConfirm={async () => {
        setPending(true)
        await wait(700)
        setPending(false)
        setAttempts((count) => count + 1)
        if (attempts % 2 === 0) {
          setError('The server said no. Try again.')
        } else {
          setOpen(false)
        }
      }}
    />
  )
}

const KitSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  return (
    <section className="mt-16 border-t pt-4">
      <h2 className="mb-6 font-mono text-2xs tracking-wide text-primary">
        kit / {title.toLowerCase()}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

const Caption = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 font-mono text-2xs text-faint-foreground">{children}</p>
)
