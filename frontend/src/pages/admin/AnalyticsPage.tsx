import { useEffect, useState } from 'react'
import { Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../api/catalogApi'
import { adminBillApi, type SalesAnalytics } from '../../api/outletApi'
import { SalesInsights } from '../../components/SalesInsights'

/** Cumulative sales across every outlet: today, this month, top outlet and top service. */
export function AnalyticsPage() {
  const [data, setData] = useState<SalesAnalytics | null>(null)
  useEffect(() => { adminBillApi.analytics().then(setData).catch((e) => notifications.show({ color: 'red', title: 'Could not load analytics', message: extractErrorMessage(e) })) }, [])
  return <Stack gap="lg">
    <div><Title order={2}>Sales analytics</Title><Text c="dimmed" size="sm">Cumulative sales across all outlets.</Text></div>
    <SalesInsights today={data?.today} month={data?.month} topOutletsToday={data?.topOutletsToday ?? []} topOutletsMonth={data?.topOutletsMonth ?? []} />
  </Stack>
}
