import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/dates/styles.css'
import './index.css'

import { theme } from './theme/theme'
import App from './App.tsx'

// Lets date inputs read typed dates in DATE_INPUT_FORMAT (dd/mm/yyyy); without it dayjs ignores the
// format and reads "11/10/2026" US-style as 10 November.
dayjs.extend(customParseFormat)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
