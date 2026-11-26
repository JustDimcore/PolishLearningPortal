import type { ReactNode } from 'react'
import type {
  LessonBlock,
  LessonBlockCardBlock,
  LessonBlockDialogueBlock,
  LessonBlockExamplesBlock,
  LessonBlockTableBlock,
} from '../../shared/api/generated/model'
import { RichText } from './RichText.tsx'

/**
 * Renders the blocks of one section. A card is shown side by side with the block that follows it
 * (a shopping list next to the dialogue that uses it).
 */
export function LessonBlocks({ blocks }: { blocks: readonly LessonBlock[] }) {
  const items: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const next = blocks[i + 1]
    if (block.type === 'card' && next) {
      items.push(
        <div key={i} className="flex flex-wrap items-start gap-11">
          <Card block={block} />
          <div className="min-w-0 flex-[1_1_360px]">
            <Block block={next} />
          </div>
        </div>,
      )
      i++
    } else {
      items.push(<Block key={i} block={block} />)
    }
  }
  return <div className="flex flex-col gap-4">{items}</div>
}

function Block({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="m-0 text-[15px] leading-normal text-muted">
          <RichText spans={block.content} />
        </p>
      )
    case 'note':
      return (
        <p className="m-0 text-[15px] leading-normal text-muted">
          {/* Lora has no "↳" glyph; the system font draws it properly. */}
          <span aria-hidden="true" className="font-sans">↳ </span>
          <RichText spans={block.content} />
        </p>
      )
    case 'list':
      return (
        <ul className="m-0 list-disc pl-5 text-[17px] leading-normal">
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText spans={item.content} />
            </li>
          ))}
        </ul>
      )
    case 'table':
      return <Table block={block} />
    case 'examples':
      return <Examples block={block} />
    case 'dialogue':
      return <Dialogue block={block} />
    case 'card':
      return <Card block={block} />
  }
}

function Examples({ block }: { block: LessonBlockExamplesBlock }) {
  return (
    <dl className="m-0 border-t-[1.5px] border-b-[1.5px] border-ink">
      {block.items.map((item, i) => (
        <div
          key={i}
          className="flex flex-wrap gap-x-6 gap-y-2 border-hairline py-3 [&:not(:last-child)]:border-b"
        >
          <dt className="flex-[0_0_200px] pt-1 font-display text-[15px] tracking-[0.06em] uppercase">{item.label}</dt>
          <dd className="m-0 flex-[1_1_300px]">
            <span lang="pl" className="block text-[17px]">
              <RichText spans={item.text} />
            </span>
            <span className="block text-[15px] text-muted">
              <RichText spans={item.translation} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Table({ block }: { block: LessonBlockTableBlock }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-base">
        <thead>
          <tr className="border-y-[1.5px] border-ink text-left font-display text-sm tracking-[0.06em] uppercase">
            {block.header.cells.map((cell, i) => (
              <th key={i} scope="col" className="px-2 py-2 font-medium first:pl-0">
                <RichText spans={cell.content} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-b border-hairline last:border-b-[1.5px] last:border-ink">
              {row.cells.map((cell, c) => (
                <td key={c} className="px-2 py-2 align-top first:pl-0">
                  <RichText spans={cell.content} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Dialogue({ block }: { block: LessonBlockDialogueBlock }) {
  return (
    <div className="flex flex-col gap-2.5">
      {block.caption && <div className="kicker">{block.caption}</div>}
      {block.lines.map((line, i) => (
        <div key={i}>
          <p className="m-0 text-[17px] leading-snug">
            <span aria-hidden="true" className="font-semibold text-vermilion-dark">
              —{' '}
            </span>
            <span lang="pl">
              <RichText spans={line.text} />
            </span>
          </p>
          {line.translation && (
            <p className="m-0 ml-[1.1em] text-[15px] text-muted">
              <RichText spans={line.translation} />
            </p>
          )}
          {line.remark && (
            <p className="m-0 mt-0.5 ml-[1.1em] font-hand text-[21px] leading-tight font-semibold text-vermilion-dark">
              ↑ {line.remark}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function Card({ block }: { block: LessonBlockCardBlock }) {
  return (
    <figure className="m-0 flex flex-[0_1_240px] flex-col gap-2">
      {block.caption && <figcaption className="kicker">{block.caption}</figcaption>}
      <div className="border-[1.5px] border-ink bg-card px-[18px] py-3.5 shadow-[4px_4px_0_var(--color-ink)]">
        <div className="mb-1.5 border-b border-hairline pb-1.5 font-display text-sm tracking-[0.08em] uppercase">
          {block.title}
        </div>
        <ul lang="pl" className="m-0 list-none p-0 text-lg leading-8">
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText spans={item.content} />
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
