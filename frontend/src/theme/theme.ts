import { createTheme } from '@mantine/core'
import { brand } from '../config/brand'
import { DATE_INPUT_FORMAT } from '../config/dateFormat'

/**
 * Central Mantine theme. Front-desk staff are non-technical, so we bias
 * toward large touch targets, high-contrast text and minimal visual noise.
 * The color itself is a one-line change in config/brand.ts — this file
 * never needs touching to reskin for a different client.
 */
export const theme = createTheme({
  primaryColor: brand.primaryColor,
  defaultRadius: 'md',
  fontSizes: {
    xs: '0.8rem',
    sm: '0.9rem',
    md: '1.05rem',
    lg: '1.25rem',
    xl: '1.6rem',
  },
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
      },
    },
    // Every date picker shows and accepts dd/mm/yyyy (see config/dateFormat.ts).
    DateInput: {
      defaultProps: {
        valueFormat: DATE_INPUT_FORMAT,
        placeholder: 'dd/mm/yyyy',
      },
    },
  },
})
