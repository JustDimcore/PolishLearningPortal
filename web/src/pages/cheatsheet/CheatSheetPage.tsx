import { SheetNav } from '../../features/cheatsheet/SheetNav.tsx'
import { ContentBlocks } from '../../features/content/ContentBlocks.tsx'
import { RichText } from '../../features/content/RichText.tsx'
import { t } from '../../i18n/index.ts'
import { useGetCheatSheet } from '../../shared/api/generated/cheat-sheet/cheat-sheet.ts'

const sectionNumber = (n: number) => String(n).padStart(2, '0')

/** The cheat sheet: one column of numbered tables, a search for word forms on the left, printable on A4. */
export function CheatSheetPage() {
  const sheet = useGetCheatSheet()

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
      {sheet.data && <SheetNav sections={sheet.data.sections} />}
      <main className="min-w-0 md:flex-[999_1_640px]">
        <div className="mx-auto flex max-w-[960px] flex-col gap-12 px-4 pt-8 pb-18 md:px-10 print:max-w-none print:gap-6 print:p-0">
          {sheet.isPending && <p className="text-muted">{t.cheatsheet.loading}</p>}
          {sheet.isError && (
            <p role="alert" className="text-vermilion-dark">
              {t.cheatsheet.loadError}
            </p>
          )}
          {sheet.data && (
            <>
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-3">
                <h1 lang="pl" className="m-0 font-display text-4xl leading-tight font-bold tracking-tight uppercase">
                  {sheet.data.title}
                </h1>
                <p className="m-0 text-[15px] text-muted">
                  <RichText spans={sheet.data.summary} />
                </p>
              </header>
              {sheet.data.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className="scroll-mt-4 print:break-inside-avoid"
                >
                  <h2
                    id={`${section.id}-title`}
                    className="mt-0 mb-4 flex items-baseline gap-3 font-display text-xl font-bold tracking-[0.01em] uppercase print:mb-2"
                  >
                    <span className="text-vermilion-dark">{sectionNumber(section.number)}</span>
                    {section.title}
                  </h2>
                  <ContentBlocks sectionId={section.id} blocks={section.blocks} />
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
