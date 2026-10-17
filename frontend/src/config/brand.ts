import type { MantineColor } from '@mantine/core'

/**
 * Everything a reskin for a different client needs to touch lives here.
 * Swap these values (and the theme's primaryColor, which reads from this
 * file) and the whole app rebrands - no hunting through components.
 */
export const brand = {
  name: "Sana's Boutique",
  tagline:
    'Built for boutique and parlour franchises — simple enough for front-desk staff, clear enough for owners checking in from anywhere.',
  primaryColor: 'violet' satisfies MantineColor,
}
