import ru from './ru.json'

// All user-facing strings live in locale files; code references them by key.
// The UI is Russian-only for now, so `t` is simply the Russian dictionary.
// If a second locale appears, swap this for a real i18n library keeping the same shape.
export type Messages = typeof ru

export const t: Messages = ru

/** Fills `{name}` placeholders in a message: format(t.lessons.next, { number: 3 }). */
export function format(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
}
