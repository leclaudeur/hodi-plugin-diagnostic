// What can be wrong with an article in the reader. The admin picks among the first ones; Hodi notes the last ones
// alone, as it reads articles.
export const PICKED = ['cut', 'extra', 'images', 'layout', 'wrong', 'other'] as const
export const SPOTTED = ['blocked', 'short', 'leftovers'] as const

export type Picked = (typeof PICKED)[number]
export type Spotted = (typeof SPOTTED)[number]
export type Issue = Picked | Spotted

export const NOTE_MAX = 500
