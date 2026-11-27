import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { format, t } from '../../i18n/index.ts'
import { useGetExerciseSets } from '../../shared/api/generated/exercises/exercises.ts'
import { exportData, importData, listSessions } from '../../shared/storage/db.ts'

const button =
  'inline-flex h-[42px] cursor-pointer items-center border-[1.5px] border-ink px-5 font-display text-sm tracking-[0.06em] uppercase no-underline'

/** Lessons with exercises, each with a start or resume button; export and import of local progress. */
export function ExercisesPage() {
  const sets = useGetExerciseSets()
  const sessions = useQuery({ queryKey: ['local', 'sessions'], queryFn: listSessions })

  return (
    <main className="mx-auto flex max-w-[880px] flex-col gap-12 px-4 pt-10 pb-18 md:px-10">
      <header>
        <div className="kicker">{t.exercises.kicker}</div>
        <h1 className="mt-2 mb-0 font-display text-4xl leading-tight font-bold tracking-tight uppercase">{t.nav.exercises}</h1>
        <p className="mt-3 mb-0 max-w-[600px] text-[17px] leading-relaxed text-muted">{t.exercises.intro}</p>
      </header>

      {sets.isPending && <p className="m-0 text-muted">{t.exercises.loading}</p>}
      {sets.isError && (
        <p role="alert" className="m-0 text-vermilion-dark">
          {t.exercises.loadError}
        </p>
      )}

      {sets.data && (
        <ol className="m-0 list-none border-t-[1.5px] border-ink p-0">
          {sets.data.sets.map((set) => {
            // A session counts as started once something is answered; an untouched one just opens again.
            const active = sessions.data?.find(
              (s) => s.key === `lesson:${set.lesson}` && !s.finishedAt && Object.keys(s.results).length > 0,
            )
            const done = active ? Object.keys(active.results).length : 0
            return (
              <li key={set.lesson} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3">
                <span className="w-7 font-display text-xl font-bold text-vermilion-dark">{set.number}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span lang="pl" className="font-display text-xl font-bold uppercase">
                    {set.title}
                  </span>
                  <span className="text-[15px] text-muted">{format(t.exercises.count, { count: set.count })}</span>
                </span>
                <Link to={`/exercises/${set.lesson}`} className={`${button} ${active ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
                  {active ? format(t.exercises.resume, { done, total: active.exercises.length }) : t.exercises.start}
                </Link>
              </li>
            )
          })}
        </ol>
      )}

      <DataSection />
    </main>
  )
}

function DataSection() {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'imported' | 'failed' | null>(null)

  async function download() {
    const data = await exportData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `mow-po-polsku-${data.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function upload(file: File) {
    if (!window.confirm(t.exercises.importConfirm)) return
    try {
      await importData(JSON.parse(await file.text()))
      await queryClient.invalidateQueries({ queryKey: ['local'] })
      setStatus('imported')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <section aria-labelledby="data-title" className="border-[1.5px] border-ink bg-surface px-6 py-5">
      <h2 id="data-title" className="m-0 font-display text-xl font-bold uppercase">
        {t.exercises.dataTitle}
      </h2>
      <p className="mt-2 mb-4 max-w-[600px] text-[15px] leading-normal">{t.exercises.dataNote}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void download()} className={`${button} bg-paper text-ink`}>
          {t.exercises.export}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={`${button} bg-paper text-ink`}>
          {t.exercises.import}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>
      {status && (
        <p role="status" className={`mt-3 mb-0 text-[15px] ${status === 'failed' ? 'text-vermilion-dark' : ''}`}>
          {status === 'failed' ? t.exercises.importError : t.exercises.importDone}
        </p>
      )}
    </section>
  )
}
