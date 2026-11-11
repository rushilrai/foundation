import { IconExternalLink } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import { AddLinkButton } from '@/components/AddLinkButton'
import { AnswerCard } from '@/components/AnswerCard'
import { ConfirmDelete } from '@/components/ConfirmDelete'
import { EmptyState, InlineError } from '@/components/EmptyState'
import { groupByMonth } from '@/components/lib/dates'
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
import { TagFilterBar, type TagCount } from '@/components/TagFilterBar'
import { TagPicker } from '@/components/TagPicker'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'

// Dev-only gallery of the UI kit with realistic sample data. Not linked from the app.

type SampleLink = {
  id: string
  title: string
  url: string
  domain: string
  summary: string | null
  summaryPending?: boolean
  description?: string
  image?: string
  tags: string[]
  savedAt: number
}

const LINKS: SampleLink[] = [
  {
    id: 'bakery',
    title: 'Theobroma Bakery & Patisserie, Colaba Causeway',
    url: 'https://maps.google.com/?cid=1234567890',
    domain: 'maps.google.com',
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
    summary: null,
    summaryPending: true,
    tags: ['restaurants', 'mumbai'],
    savedAt: Date.UTC(2026, 10, 6, 21, 40),
  },
  {
    id: 'hairlines',
    title:
      'The unreasonable effectiveness of hairlines: notes on typographic restraint in interface design, with examples from seventy years of print',
    url: 'https://longform.thedesignquarterlyjournalofeverything.co.uk/2026/hairlines',
    domain: 'longform.thedesignquarterlyjournalofeverything.co.uk',
    summary:
      'An essay arguing that thin rules, generous margins and two typefaces do more for hierarchy than colour or boxes ever do, with case studies from Swiss posters, mid-century annual reports and today’s best reading apps.',
    tags: ['ui', 'design', 'reading', 'typography', 'longreads'],
    savedAt: Date.UTC(2026, 9, 28, 7, 15),
  },
  {
    id: 'pocket',
    title: 'Pocket is shutting down. Here’s what to do with your saves',
    url: 'https://www.theverge.com/2025/pocket-shutting-down',
    domain: 'theverge.com',
    summary: null,
    tags: ['reading'],
    savedAt: Date.UTC(2026, 9, 2, 12, 0),
  },
  {
    id: 'canteen',
    title: 'The Bombay Canteen',
    url: 'https://maps.google.com/?cid=987654321',
    domain: 'maps.google.com',
    summary:
      'Regional Indian small plates in Lower Parel; book ahead for weekends.',
    tags: ['places', 'restaurants', 'mumbai'],
    savedAt: Date.UTC(2025, 11, 14, 20, 0),
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

const TAG_COUNTS: TagCount[] = TAG_NAMES.map((name, index) => ({
  name,
  count: [116, 81, 34, 26, 58, 40, 9][index] ?? Math.max(1, 30 - index / 3),
})).map((tag) => ({ ...tag, count: Math.round(tag.count) }))

const SUGGESTIONS = ['bakery', 'mumbai', 'cafe', 'dessert']

export const KitScreen = () => {
  return (
    <main className="page-column fab-clearance">
      <HomePreview />

      <KitSection title="Search">
        <SearchDemo initial="" />
        <SearchDemo initial="bakeries near colaba" />
        <SearchDemo initial="where did I save that bandra place?" busy />
      </KitSection>

      <KitSection title="Tag filter">
        <FilterDemo />
      </KitSection>

      <KitSection title="Tags">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TAG_NAMES.slice(0, 24).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1">
              <Tag name={tag} />
              <span className="font-mono text-[0.625rem] text-faint-foreground">
                {tagColorIndex(tag) + 1}
              </span>
            </span>
          ))}
        </div>
      </KitSection>

      <KitSection title="Link rows">
        <div>
          <MonthHeading className="pt-0">November</MonthHeading>
          <LinkRow
            {...LINKS[0]}
            titleOpensLink
            onSelect={() => undefined}
            onTagSelect={() => undefined}
          />
          <LinkRow {...LINKS[3]} onSelect={() => undefined} />
          <LinkRow {...LINKS[2]} onSelect={() => undefined} />
          <LinkRow {...LINKS[4]} />
          <LinkRowSkeleton />
          <LinkRowSkeleton />
        </div>
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
      </KitSection>

      <KitSection title="Answer">
        <div className="flex flex-col gap-4">
          <AnswerCard
            question="where did I save that bandra place?"
            answer="You saved a Reddit thread on 6 November about dinner in Bandra; the top picks were Bastian and Candies."
            onDismiss={() => undefined}
          />
          <AnswerCard loading question="best bakery in colaba?" />
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
          <InlineError>That doesn’t look like a link.</InlineError>
        </div>
      </KitSection>

      <KitSection title="Delete">
        <ConfirmDelete
          onConfirm={() => new Promise((resolve) => setTimeout(resolve, 900))}
        />
      </KitSection>

      <KitSection title="Sheets">
        <SheetDemos />
      </KitSection>
    </main>
  )
}

const HomePreview = () => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [selected, setSelected] = useState<SampleLink | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const visible = useMemo(
    () =>
      LINKS.filter(
        (link) =>
          (!active || link.tags.includes(active)) &&
          (!query || link.title.toLowerCase().includes(query.toLowerCase())),
      ),
    [active, query],
  )
  const groups = groupByMonth(visible, (link) => link.savedAt, {
    now: Date.UTC(2026, 10, 12),
  })

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
                onSelect={() => setSelected(link)}
              />
            ))}
          </section>
        ))
      )}

      <AddLinkButton onClick={() => setSaveOpen(true)} />

      <DetailSheet link={selected} onClose={() => setSelected(null)} />
      <SaveSheet open={saveOpen} onOpenChange={setSaveOpen} />
    </section>
  )
}

const SearchDemo = ({
  initial,
  busy = false,
}: {
  initial: string
  busy?: boolean
}) => {
  const [value, setValue] = useState(initial)
  return <SearchField value={value} onChange={setValue} busy={busy} />
}

const FilterDemo = () => {
  const [active, setActive] = useState<string | null>('dev')
  return (
    <TagFilterBar
      tags={TAG_COUNTS.slice(0, 6)}
      active={active}
      onChange={setActive}
    />
  )
}

const TagPickerDemo = () => {
  const [tags, setTags] = useState(['places', 'restaurants'])
  return (
    <>
      <TagPicker
        value={tags}
        onChange={setTags}
        suggestions={SUGGESTIONS}
        allTags={TAG_NAMES}
      />
      <p
        className="mt-4 font-mono text-[0.6875rem] text-faint-foreground"
        data-testid="tag-picker-value"
      >
        value: {JSON.stringify(tags)}
      </p>
    </>
  )
}

const DetailSheet = ({
  link,
  onClose,
}: {
  link: SampleLink | null
  onClose: () => void
}) => {
  // Keep the last link while the sheet animates closed.
  const [shown, setShown] = useState(link)
  const [tags, setTags] = useState<string[]>([])
  useEffect(() => {
    if (link) {
      setShown(link)
      setTags(link.tags)
    }
  }, [link])

  return (
    <Drawer
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DrawerContent>
        {shown && (
          <>
            <DrawerHeader>
              <DrawerTitle className="sr-only">{shown.title}</DrawerTitle>
              <DrawerDescription className="font-mono text-[0.6875rem]">
                Saved{' '}
                {new Date(shown.savedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <LinkPreviewCard
                title={shown.title}
                domain={shown.domain}
                description={shown.summary ?? shown.description}
                image={shown.image}
              />
              <Button
                className="h-11"
                nativeButton={false}
                render={
                  <a
                    href={shown.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Open link
                <IconExternalLink data-icon="inline-end" aria-hidden />
              </Button>
              <TagPicker
                value={tags}
                onChange={setTags}
                suggestions={SUGGESTIONS}
                allTags={TAG_NAMES}
              />
              <div className="-mx-3 border-t pt-2">
                <ConfirmDelete
                  onConfirm={() =>
                    new Promise((resolve) => setTimeout(resolve, 700)).then(
                      onClose,
                    )
                  }
                />
              </div>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

const SaveSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setTags([])
    const timer = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [open])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Save a link</DrawerTitle>
          <DrawerDescription>
            We’ll read the page and suggest tags.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <Input
            aria-label="Link"
            type="url"
            inputMode="url"
            defaultValue="https://maps.google.com/?cid=1234567890"
          />
          {loading ? (
            <LinkPreviewCardSkeleton />
          ) : (
            <LinkPreviewCard
              title={LINKS[0].title}
              domain={LINKS[0].domain}
              description={LINKS[0].description}
              image={LINKS[0].image}
            />
          )}
          <TagPicker
            value={tags}
            onChange={setTags}
            suggestions={SUGGESTIONS}
            allTags={TAG_NAMES}
            suggestionsLoading={loading}
          />
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost" className="h-11" />}>
            Cancel
          </DrawerClose>
          <Button className="h-11 px-6" onClick={() => onOpenChange(false)}>
            Save link
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

const SheetDemos = () => {
  const [detail, setDetail] = useState<SampleLink | null>(null)
  const [save, setSave] = useState(false)

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="h-11 px-4"
        onClick={() => setDetail(LINKS[0])}
      >
        Open link detail
      </Button>
      <Button
        variant="outline"
        className="h-11 px-4"
        onClick={() => setSave(true)}
      >
        Open save sheet
      </Button>
      <DetailSheet link={detail} onClose={() => setDetail(null)} />
      <SaveSheet open={save} onOpenChange={setSave} />
    </div>
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
      <h2 className="mb-6 font-mono text-[0.6875rem] tracking-wide text-primary">
        kit / {title.toLowerCase()}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

const Caption = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 font-mono text-[0.6875rem] text-faint-foreground">
    {children}
  </p>
)
