import type { ReactNode } from 'react'
import type { InlineSpan } from '../../shared/api/generated/model'

/** Renders server-side rich text: bold, italic and highlighted grammatical endings. */
export function RichText({ spans }: { spans: readonly InlineSpan[] }) {
  return spans.map((span, index) => {
    let node: ReactNode = span.text
    if (span.marks.includes('ending')) node = <b className="font-bold text-cobalt">{node}</b>
    if (span.marks.includes('italic')) node = <i>{node}</i>
    if (span.marks.includes('bold') && !span.marks.includes('ending')) node = <b>{node}</b>
    // Spans never change order within a block, so the index is a stable key.
    return <span key={index}>{node}</span>
  })
}
