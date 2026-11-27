import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { format, t } from '../../i18n/index.ts'
import type {
  AnswerCheck,
  ExerciseDeclensionTableExercise,
  Exercise,
  ExerciseFillGapExercise,
  GapText,
  ExerciseMultipleChoiceExercise,
} from '../../shared/api/generated/model'
import type { ExerciseResult } from '../../shared/storage/db.ts'
import { RichText } from '../content/RichText.tsx'
import { gapCount } from './exercise.ts'

type Props = {
  exercise: Exercise
  result: ExerciseResult | undefined
  /** Sends the answers for checking; an empty list means "I don't know". */
  onSubmit: (answers: string[]) => Promise<void>
  onNext: () => void
  isLast: boolean
}

/** One exercise: the task, the answer controls, then the verdict in place (role="status"). */
export function ExerciseCard({ exercise, result, onSubmit, onNext, isLast }: Props) {
  // The card is keyed by exercise id, so the draft starts empty for every exercise.
  const [draft, setDraft] = useState<string[]>(() => Array.from({ length: gapCount(exercise) }, () => ''))
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const checked = result?.check

  async function submit(answers: string[]) {
    setPending(true)
    setFailed(false)
    try {
      await onSubmit(answers)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  // Set when "Check" is pressed with an empty field: the hint says what is missing instead of a dead button.
  const [missing, setMissing] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (checked) {
      onNext()
      return
    }
    const empty = draft.findIndex((a) => a.trim() === '')
    if (empty === -1) {
      void submit(draft)
    } else {
      setMissing(true)
      inputs.current[empty]?.focus()
    }
  }

  const setAnswer = (index: number, value: string) => {
    setMissing(false)
    setDraft((d) => d.map((a, i) => (i === index ? value : a)))
  }
  const answers = checked?.answers
  const isChoice = exercise.type === 'multiple-choice'

  // Text inputs register here so the Polish letter buttons can type into the last focused one.
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const lastFocused = useRef(0)
  const inputProps = (index: number): InputProps => ({
    ref: (el) => {
      inputs.current[index] = el
    },
    onFocus: () => {
      lastFocused.current = index
    },
    'aria-describedby': missing ? missingHintId : undefined,
  })
  const missingHintId = `${exercise.id}-missing`

  function insertLetter(letter: string) {
    const index = lastFocused.current
    const input = inputs.current[index]
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    setAnswer(index, input.value.slice(0, start) + letter + input.value.slice(end))
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + letter.length, start + letter.length)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col border-[1.5px] border-ink bg-card shadow-[4px_4px_0_var(--color-ink)]">
      <div className="px-5 py-6 md:px-7">
        {/* The instruction stays quieter than the Polish sentence: the eye goes to the task itself. */}
        <h1 className="mt-0 mb-4 font-display text-base leading-tight font-bold tracking-[0.04em] uppercase md:text-lg">
          {exercise.instruction}
        </h1>
        {/* The task as one group: base form, sentence, translation right under it. */}
        <div className="flex flex-col gap-1.5">
        {exercise.type === 'fill-gap' && (
          <FillGap
            exercise={exercise}
            value={draft[0]}
            onChange={(v) => setAnswer(0, v)}
            check={answers?.[0]}
            disabled={!!checked || pending}
            input={inputProps(0)}
          />
        )}
        {exercise.type === 'multiple-choice' && (
          <Choice
            exercise={exercise}
            picked={draft[0]}
            onPick={(option) => {
              setAnswer(0, option)
              void submit([option])
            }}
            check={answers?.[0]}
            disabled={!!checked || pending}
          />
        )}
        {exercise.type === 'declension-table' && (
          <Table exercise={exercise} values={draft} onChange={setAnswer} checks={answers} disabled={!!checked || pending} input={inputProps} />
        )}
        {/* A table shows the translation in its caption. */}
        {exercise.translation && exercise.type !== 'declension-table' && (
          <p className="m-0 text-[15px] text-muted">{exercise.translation}</p>
        )}
        </div>
        {!checked && !isChoice && (
          <div className="mt-5">
            <PolishLetters onInsert={insertLetter} disabled={pending} />
          </div>
        )}
      </div>

      {/* A light divider while answering; after the check the verdict zone gets a tint to stand out. */}
      <div className={`flex flex-col gap-3 border-t border-hairline px-5 py-4 md:px-7 ${checked ? 'bg-surface/60' : ''}`}>
        {/* Always rendered, so screen readers announce the verdict when it appears. */}
        <div role="status" className="flex flex-col items-start gap-2 empty:hidden">
          {checked && (
            <>
              <VerdictLabel verdict={checked.verdict} />
              <p className="m-0 text-base leading-relaxed">
                <RichText spans={checked.explanation} />
              </p>
            </>
          )}
        </div>
        {failed && (
          <p role="alert" className="m-0 text-vermilion-dark">
            {t.session.checkError}
          </p>
        )}
        {missing && !checked && (
          <p id={missingHintId} className="m-0 text-sm text-vermilion-dark">
            {t.session.missingAnswer}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {checked ? (
            <button type="submit" autoFocus className={primaryButton}>
              {isLast ? t.session.finish : t.session.next}
            </button>
          ) : (
            <>
              {/* A choice is checked as soon as an option is picked. */}
              {!isChoice && (
                <button type="submit" disabled={pending} className={primaryButton}>
                  {pending ? t.session.checking : t.session.check}
                </button>
              )}
              <button type="button" disabled={pending} onClick={() => void submit([])} className={tertiaryButton}>
                {t.session.dontKnow}
              </button>
            </>
          )}
          {isChoice && !checked ? (
            <span className="ml-auto text-xs text-muted">{pending ? t.session.checking : t.session.pickHint}</span>
          ) : (
            <span className="ml-auto hidden text-xs text-muted md:inline">
              <kbd className="border border-hairline px-1 font-sans">Enter</kbd> {checked ? t.session.enterNext : t.session.enterCheck}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

const primaryButton =
  'h-[42px] cursor-pointer border-[1.5px] border-ink bg-ink px-5 font-display text-sm tracking-[0.06em] text-paper uppercase disabled:cursor-default disabled:opacity-50'
/** A secondary way out ("I don't know"): visible but lighter than the main action. */
const tertiaryButton =
  'h-[42px] cursor-pointer border-0 bg-transparent px-2 font-display text-sm tracking-[0.06em] text-muted uppercase underline underline-offset-4 hover:text-ink disabled:opacity-50'

/** The verdict as a badge; the symbol repeats what the colour says. */
function VerdictLabel({ verdict }: { verdict: AnswerCheck['verdict'] }) {
  const badge = 'inline-flex h-7 items-center gap-1.5 px-2.5 font-display text-sm tracking-[0.06em] uppercase'
  switch (verdict) {
    case 'correct':
      return <span className={`${badge} bg-ink text-paper`}>{t.session.resultCorrect}</span>
    case 'almost':
      return <span className={`${badge} border-[1.5px] border-vermilion-dark text-vermilion-dark`}>{t.session.resultAlmost}</span>
    case 'wrong':
      return <span className={`${badge} bg-vermilion-dark text-paper`}>{t.session.resultWrong}</span>
    case 'skipped':
      return <span className={`${badge} bg-surface text-muted`}>{t.session.resultSkipped}</span>
  }
}

/** The learner's answer and the correction, or the confirmed answer when it was right. */
export function Correction({ check }: { check: AnswerCheck }) {
  if (check.verdict === 'correct') {
    return (
      <ins lang="pl" className="font-semibold text-ink no-underline">
        {check.given}
        <span aria-hidden="true" className="ml-1 text-[0.8em]">
          ✓
        </span>
      </ins>
    )
  }
  return (
    <span lang="pl">
      {check.given && (
        <>
          <del className="text-muted decoration-vermilion-dark decoration-2">
            <span className="sr-only">{t.session.yourAnswer} </span>
            {check.given}
          </del>{' '}
        </>
      )}
      <ins className="font-semibold text-cobalt underline decoration-cobalt decoration-2 underline-offset-4">
        <span className="sr-only">{t.session.correctAnswer} </span>
        {check.expected}
      </ins>
    </span>
  )
}

export function Sentence({ text, gap }: { text: GapText; gap: ReactNode }) {
  // Keep punctuation right after the gap on the same line as the gap ("___." never wraps before the dot).
  const [first, ...rest] = text.after
  const punctuation = first?.text.match(/^[.,!?;:…]+/)?.[0] ?? ''
  const after = punctuation ? [{ ...first, text: first.text.slice(punctuation.length) }, ...rest] : text.after
  return (
    <p lang="pl" className="m-0 text-2xl leading-[2]">
      <RichText spans={text.before} />
      {text.hasGap && (
        <span className="whitespace-nowrap">
          {gap}
          {punctuation}
        </span>
      )}
      <RichText spans={after} />
    </p>
  )
}

/** An answer field drawn as an underlined gap in the line, not as a box. */
const inputClass =
  'h-[1.5em] border-0 border-b-2 border-ink bg-transparent px-1 py-0 align-baseline font-serif text-[length:inherit] leading-none text-ink focus:border-cobalt focus:bg-paper focus-visible:outline-none disabled:opacity-100'

type InputProps = {
  ref: (el: HTMLInputElement | null) => void
  onFocus: () => void
  'aria-describedby': string | undefined
}

const POLISH_LETTERS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż']

/** Buttons for the Polish letters an English keyboard lacks; they type into the last focused input. */
function PolishLetters({ onInsert, disabled }: { onInsert: (letter: string) => void; disabled: boolean }) {
  // One Tab stop for the whole row (roving tabindex): Tab goes on to "Check", arrows move between letters.
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    const target = step ? (index + step + POLISH_LETTERS.length) % POLISH_LETTERS.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? POLISH_LETTERS.length - 1
      : null
    if (target === null) return
    event.preventDefault()
    setActive(target)
    buttons.current[target]?.focus()
  }

  return (
    // Phones get a full-width row of larger targets; on desktop the buttons stay small.
    <div role="group" aria-label={t.session.letters} className="grid grid-cols-9 gap-1 md:flex md:flex-wrap">
      {POLISH_LETTERS.map((letter, index) => (
        <button
          key={letter}
          ref={(el) => {
            buttons.current[index] = el
          }}
          type="button"
          lang="pl"
          tabIndex={index === active ? 0 : -1}
          onKeyDown={(e) => move(e, index)}
          disabled={disabled}
          aria-label={format(t.session.insertLetter, { letter })}
          // Keep the focus (and the caret) in the input while clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(letter)}
          className="h-10 cursor-pointer border-0 bg-surface font-serif text-base leading-none text-ink hover:bg-hairline disabled:opacity-50 md:h-6 md:w-6"
        >
          {letter}
        </button>
      ))}
    </div>
  )
}

type FillGapProps = {
  exercise: ExerciseFillGapExercise
  value: string
  onChange: (value: string) => void
  check?: AnswerCheck
  disabled: boolean
  input: InputProps
}

function FillGap({ exercise, value, onChange, check, disabled, input }: FillGapProps) {
  return (
    <>
      <div className="text-base text-muted">
        {t.session.base}{' '}
        <b lang="pl" className="font-semibold text-ink">
          {exercise.base}
        </b>
      </div>
      <Sentence
        text={exercise.sentence}
        gap={
          check ? (
            <Correction check={check} />
          ) : (
            <label className="mr-0.5 ml-1 inline-block align-baseline">
              <span className="sr-only">{t.session.answerLabel}</span>
              <input
                {...input}
                lang="pl"
                autoFocus
                enterKeyHint="done"
                autoComplete="off"
                spellCheck={false}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className={`${inputClass} field-sizing-content min-w-[6ch] max-w-[14ch]`}
              />
            </label>
          )
        }
      />
    </>
  )
}

type ChoiceProps = {
  exercise: ExerciseMultipleChoiceExercise
  picked: string
  onPick: (option: string) => void
  check?: AnswerCheck
  disabled: boolean
}

function Choice({ exercise, picked, onPick, check, disabled }: ChoiceProps) {
  const gap = check ? <Correction check={check} /> : <span className="inline-block min-w-16 border-b-2 border-ink px-1">{picked || ' '}</span>
  return (
    <>
      <Sentence text={exercise.prompt} gap={gap} />
      <div role="group" aria-label={exercise.instruction} className="flex flex-wrap gap-2.5">
        {exercise.options.map((option) => {
          const isExpected = check && option === check.expected
          const isWrongPick = check && option === check.given && check.verdict !== 'correct'
          // After the check: the right option is filled, a wrong pick is struck out, the rest fade.
          const look = !check
            ? option === picked
              ? 'border-ink bg-ink text-paper'
              : 'border-ink bg-paper text-ink'
            : isExpected
              ? 'border-cobalt bg-cobalt font-semibold text-paper'
              : isWrongPick
                ? 'border-vermilion-dark bg-paper text-vermilion-dark line-through'
                : 'border-ink bg-paper text-ink opacity-60'
          return (
            <button
              key={option}
              type="button"
              lang="pl"
              disabled={disabled}
              aria-pressed={option === picked}
              onClick={() => onPick(option)}
              className={`flex h-[42px] cursor-pointer items-center gap-1.5 border-[1.5px] px-4 font-serif text-lg disabled:cursor-default ${look}`}
            >
              {option}
              {isExpected && <span aria-hidden="true">✓</span>}
              {isWrongPick && <span aria-hidden="true">✕</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

type TableProps = {
  exercise: ExerciseDeclensionTableExercise
  values: string[]
  onChange: (index: number, value: string) => void
  checks?: AnswerCheck[]
  disabled: boolean
  input: (index: number) => InputProps
}

function Table({ exercise, values, onChange, checks, disabled, input }: TableProps) {
  // Position of each open row among the answers (null for rows given as hints).
  const answerIndex = exercise.rows.map((_, i) =>
    exercise.rows[i].given === null ? exercise.rows.slice(0, i).filter((r) => r.given === null).length : null,
  )
  return (
    <table className="w-full max-w-[560px] border-collapse text-lg">
      <caption className="pb-2 text-left text-[15px] text-muted">
        <b lang="pl" className="text-ink">{exercise.word}</b>
        {exercise.translation && ` — ${exercise.translation}`}
      </caption>
      <tbody>
        {exercise.rows.map((row, i) => {
          const index = answerIndex[i] ?? 0
          return (
            <tr key={row.label} className="border-b border-hairline last:border-b-0">
              <th scope="row" className="w-2/5 py-2.5 pr-4 text-left align-middle text-[15px] font-normal text-muted">
                {row.label}
              </th>
              <td lang="pl" className="py-2.5">
                {row.given !== null ? (
                  row.given
                ) : checks ? (
                  <Correction check={checks[index]} />
                ) : (
                  <label>
                    <span className="sr-only">{row.label}</span>
                    <input
                      {...input(index)}
                      lang="pl"
                      autoFocus={index === 0}
                      enterKeyHint={index === values.length - 1 ? 'done' : 'next'}
                      autoComplete="off"
                      spellCheck={false}
                      value={values[index]}
                      disabled={disabled}
                      onChange={(e) => onChange(index, e.target.value)}
                      className={`${inputClass} w-full max-w-[12ch]`}
                    />
                  </label>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
