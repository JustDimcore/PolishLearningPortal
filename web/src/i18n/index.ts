import ru from './ru.json'

// All user-facing strings live in locale files; code references them by key.
// The UI is Russian-only for now, so `t` is simply the Russian dictionary.
// If a second locale appears, swap this for a real i18n library keeping the same shape.
export type Messages = typeof ru

export const t: Messages = ru
