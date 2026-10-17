import { useEffect, useState } from 'react'
import { Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { extractErrorMessage } from '../../api/catalogApi'
import { outletServiceApi, type SalesAnalytics } from '../../api/outletApi'
import { SalesInsights } from '../../components/SalesInsights'

/** Everything sales-related for this outlet: today, this month, top services and service breakdowns. */
export function OutletAnalyticsPage() {
  const [data, setData] = useState<SalesAnalytics | null>(null)
  useEffect(() => { outletServiceApi.analytics().then(setData).catch((e) => notifications.show({ color: 'red', title: 'Could not load analytics', message: extractErrorMessage(e) })) }, [])
  return <Stack gap="lg">
    <div><Title order={2}>Analytics</Title><Text c="dimmed" size="sm">Sales of this outlet.</Text></div>
    <SalesInsights today={data?.today} month={data?.month} />
  </Stack>
}
