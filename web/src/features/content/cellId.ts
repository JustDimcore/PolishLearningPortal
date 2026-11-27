/** Id of a table cell, used as a link target by the cheat sheet search. */
export function cellId(sectionId: string, block: number, row: number, column: number) {
  return `${sectionId}-b${block}-r${row}-c${column}`
}
