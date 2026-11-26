import { Link, useParams } from 'react-router'
import { CourseNav } from '../../features/lessons/CourseNav.tsx'
import { LessonBlocks } from '../../features/lessons/LessonBlocks.tsx'
import { RichText } from '../../features/lessons/RichText.tsx'
import { format, t } from '../../i18n/index.ts'
import { ApiError } from '../../shared/api/fetcher.ts'
import { useGetCourse, useGetLesson } from '../../shared/api/generated/lessons/lessons.ts'
import type { LessonDetail, LessonLink } from '../../shared/api/generated/model'
import { PlaceholderPage } from '../PlaceholderPage.tsx'

const sectionNumber = (n: number) => String(n).padStart(2, '0')

export function LessonPage() {
  const { slug = '' } = useParams()
  const lesson = useGetLesson(slug)
  const course = useGetCourse()

  if (lesson.error instanceof ApiError && lesson.error.status === 404) {
    return <PlaceholderPage title={t.lessons.notFoundTitle} note={t.lessons.notFoundNote} />
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
      {course.data && <CourseNav course={course.data} currentSlug={slug} />}
      <main className="min-w-0 md:flex-[999_1_640px]">
        {lesson.isPending && <p className="px-4 py-10 text-muted md:px-10">{t.lessons.loading}</p>}
        {lesson.isError && (
          <p role="alert" className="px-4 py-10 text-vermilion-dark md:px-10">
            {t.lessons.loadError}
          </p>
        )}
        {lesson.data && <LessonView lesson={lesson.data} />}
      </main>
    </div>
  )
}

function LessonView({ lesson }: { lesson: LessonDetail }) {
  return (
    <>
      <section aria-labelledby="lesson-title" className="border-b-[1.5px] border-ink">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-start gap-10 px-4 py-8 md:px-10">
          <div className="min-w-0 flex-[3_1_480px]">
            <div className="kicker">
              {format(t.lessons.position, {
                group: lesson.group.title,
                position: lesson.group.position,
                count: lesson.group.count,
              })}
            </div>
            <h1
              id="lesson-title"
              lang="pl"
              className="mt-2.5 mb-0 font-display text-4xl leading-[1.05] font-bold tracking-[-0.01em] uppercase"
            >
              {lesson.title}
            </h1>
            <p className="mt-3 mb-0 max-w-[600px] text-[17px] leading-relaxed">
              <RichText spans={lesson.summary} />
            </p>
          </div>
          <nav aria-label={t.lessons.plan} className="min-w-0 flex-[2_1_280px] border-l-[1.5px] border-ink pl-7">
            <div className="kicker mb-2.5">{format(t.lessons.planTitle, { minutes: lesson.minutes })}</div>
            {lesson.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-baseline gap-4 border-hairline py-1.5 text-[15px] no-underline [&:not(:last-child)]:border-b"
              >
                <span className="w-7 font-display font-bold">{sectionNumber(section.number)}</span>
                {section.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto flex max-w-[960px] flex-col gap-12 px-4 pt-10 pb-18 md:px-10">
        {lesson.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-4">
            <h2
              id={`${section.id}-title`}
              className="mt-0 mb-4 flex items-baseline gap-3 font-display text-xl font-bold tracking-[0.01em] uppercase"
            >
              <span className="text-vermilion-dark">{sectionNumber(section.number)}</span>
              {section.title}
            </h2>
            <LessonBlocks blocks={section.blocks} />
          </section>
        ))}

        {(lesson.previous || lesson.next) && (
          <nav
            aria-label={t.lessons.neighbours}
            className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] border-y-[1.5px] border-ink"
          >
            {lesson.previous ? <Neighbour lesson={lesson.previous} direction="previous" /> : <span />}
            {lesson.next && <Neighbour lesson={lesson.next} direction="next" />}
          </nav>
        )}
      </div>
    </>
  )
}

function Neighbour({ lesson, direction }: { lesson: LessonLink; direction: 'previous' | 'next' }) {
  const isNext = direction === 'next'
  return (
    <Link
      to={`/lessons/${lesson.slug}`}
      className={`flex flex-col gap-1 py-5 no-underline ${
        isNext ? 'items-end pl-6 text-right' : 'border-r border-hairline pr-6'
      }`}
    >
      <span className="kicker">{format(isNext ? t.lessons.next : t.lessons.previous, { number: lesson.number })}</span>
      <span lang="pl" className="font-display text-xl font-bold uppercase">
        {lesson.title}
      </span>
      <span className="text-[15px] text-muted">{lesson.subtitle}</span>
    </Link>
  )
}
