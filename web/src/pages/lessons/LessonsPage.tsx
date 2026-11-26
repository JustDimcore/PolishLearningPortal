import { Link } from 'react-router'
import { t } from '../../i18n/index.ts'
import { useGetCourse } from '../../shared/api/generated/lessons/lessons.ts'

/** Course contents: lesson groups with numbered lessons. */
export function LessonsPage() {
  const course = useGetCourse()

  return (
    <main className="mx-auto max-w-[880px] px-4 pt-10 pb-18 md:px-10">
      <div className="kicker">{t.lessons.kicker}</div>
      <h1 className="mt-2 mb-0 font-display text-4xl leading-tight font-bold tracking-tight uppercase">
        {t.nav.lessons}
      </h1>
      <p className="mt-3 mb-0 max-w-[600px] text-[17px] leading-relaxed text-muted">{t.lessons.intro}</p>

      {course.isPending && <p className="mt-12 text-muted">{t.lessons.loading}</p>}
      {course.isError && (
        <p role="alert" className="mt-12 text-vermilion-dark">
          {t.lessons.courseLoadError}
        </p>
      )}

      <div className="mt-12 flex flex-col gap-12">
        {course.data?.groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2
              id={`group-${group.id}`}
              className="mt-0 mb-0 border-b-[1.5px] border-ink pb-2 font-display text-xl font-bold tracking-[0.01em] uppercase"
            >
              {group.title}
            </h2>
            <ol className="m-0 list-none p-0">
              {group.lessons.map((lesson) => (
                <li key={lesson.slug} className="border-b border-hairline">
                  <Link
                    to={`/lessons/${lesson.slug}`}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 no-underline"
                  >
                    <span className="w-7 font-display text-xl font-bold text-vermilion-dark">{lesson.number}</span>
                    <span lang="pl" className="font-display text-xl font-bold uppercase">
                      {lesson.title}
                    </span>
                    <span className="text-[15px] text-muted">{lesson.subtitle}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  )
}
