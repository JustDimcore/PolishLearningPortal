import { t } from '../i18n/index.ts'

type Props = {
  title: string
  note: string
}

export function PlaceholderPage({ title, note }: Props) {
  return (
    <main className="mx-auto max-w-[880px] px-4 pt-10 pb-18 md:px-10">
      <div className="kicker">{t.placeholder.kicker}</div>
      <h1 className="mt-2 font-display text-4xl leading-tight font-bold tracking-tight uppercase">{title}</h1>
      <p className="mt-3 max-w-[600px] text-[17px] leading-relaxed text-muted">{note}</p>
    </main>
  )
}
