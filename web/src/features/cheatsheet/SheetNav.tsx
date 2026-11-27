import { useId, useState } from 'react'
import { format, t } from '../../i18n/index.ts'
import { useSearchForms } from '../../shared/api/generated/cheat-sheet/cheat-sheet.ts'
import type { ContentSection, FormHit } from '../../shared/api/generated/model'
import { useDebouncedValue } from '../../shared/useDebouncedValue.ts'
import { cellId } from '../content/cellId.ts'

const sectionNumber = (n: number) => String(n).padStart(2, '0')

/**
 * Left column of the cheat sheet: form search, table of contents and print button.
 * While a query is typed, results replace the table of contents; a result links to the matching cell.
 */
export function SheetNav({ sections }: { sections: readonly ContentSection[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const term = useDebouncedValue(query.trim(), 150)
  const search = useSearchForms({ q: term }, { query: { enabled: term.length > 0 } })

  return (
    <nav
      aria-label={t.cheatsheet.sideLabel}
      data-print="hide"
      className="border-b-[1.5px] border-ink px-4 py-3 md:max-w-[280px] md:flex-[1_1_240px] md:border-r-[1.5px] md:border-b-0 md:pt-8 md:pr-6 md:pb-10 md:pl-10"
    >
      {/* The column border spans the page; its content stays in view while the sheet scrolls. */}
      <div className="flex flex-col gap-3 md:sticky md:top-8 md:max-h-[calc(100vh-4rem)] md:gap-6 md:overflow-y-auto">
      <label className="block">
        <span className="sr-only">{t.cheatsheet.searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.cheatsheet.searchPlaceholder}
          lang="pl"
          className="h-11 w-full border-[1.5px] border-ink bg-card px-3 font-serif text-base placeholder:text-muted"
        />
      </label>

      {term.length > 0 ? (
        <SearchResults hits={search.data?.hits} exact={search.data?.exact ?? true} pending={search.isFetching} failed={search.isError} />
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 cursor-pointer items-center justify-between border-[1.5px] border-ink bg-paper px-3 font-display text-sm tracking-[0.06em] text-ink uppercase md:hidden"
          >
            {t.cheatsheet.tocToggle}
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
          <div id={listId} className={`${open ? 'flex' : 'hidden'} flex-col md:flex`}>
            <div className="mb-1.5 border-b-[1.5px] border-ink pb-2 font-display text-sm tracking-[0.08em] text-muted uppercase">
              {t.cheatsheet.toc}
            </div>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpen(false)}
                className="flex items-baseline gap-2.5 py-2 text-base no-underline"
              >
                <span className="w-6 font-display text-muted">{sectionNumber(s.number)}</span>
                {s.title}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden h-[42px] cursor-pointer border-[1.5px] border-ink bg-paper px-4 font-display text-sm tracking-[0.06em] text-ink uppercase md:block"
          >
            {t.cheatsheet.print}
          </button>
        </>
      )}
      </div>
    </nav>
  )
}

type ResultsProps = {
  hits: readonly FormHit[] | undefined
  exact: boolean
  pending: boolean
  failed: boolean
}

function SearchResults({ hits, exact, pending, failed }: ResultsProps) {
  let status: string
  if (failed) status = t.cheatsheet.searchError
  else if (!hits) status = t.cheatsheet.searching
  else if (hits.length === 0) status = t.cheatsheet.notFound
  else status = format(exact ? t.cheatsheet.found : t.cheatsheet.similar, { count: hits.length })

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <div role="status" className="font-display text-sm tracking-[0.08em] text-muted uppercase">
        {status}
      </div>
      {hits?.length === 0 && <p className="m-0 text-[15px] leading-normal text-muted">{t.cheatsheet.notFoundNote}</p>}
      {hits?.map((hit) => (
        <a
          key={`${hit.sectionId}-${hit.block}-${hit.row}-${hit.column}-${hit.form}`}
          href={`#${cellId(hit.sectionId, hit.block, hit.row, hit.column)}`}
          className="flex flex-col gap-0.5 border-b border-hairline py-2 no-underline"
        >
          <span className="kicker">
            {sectionNumber(hit.sectionNumber)} · {hit.sectionTitle}
          </span>
          <span className="text-base">
            <mark lang="pl" className="bg-vermilion/15 px-0.5 text-ink">
              {hit.form}
            </mark>{' '}
            — {[hit.rowLabel, hit.columnLabel].filter(Boolean).join(', ')}
          </span>
        </a>
      ))}
    </div>
  )
}
