import { useEffect, useState } from 'react'
import { Stack, Text, Title } from '@mantine/core'
import { serviceApi } from '../../api/catalogApi'
import { adminBillApi, outletApi } from '../../api/outletApi'
import { ReportBuilder } from '../../components/ReportBuilder'

/** Admin sales reports: choose outlets, dates and services, then preview and download. */
export function ReportsPage() {
  const [outlets, setOutlets] = useState<{ value: string; label: string }[]>([])
  const [services, setServices] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    outletApi.list().then((all) => setOutlets(all.map((o) => ({ value: String(o.id), label: o.name })))).catch(() => undefined)
    serviceApi.list().then((all) => setServices(all.map((s) => ({ value: String(s.id), label: s.name })))).catch(() => undefined)
  }, [])
  return <Stack gap="lg">
    <div><Title order={2}>Reports</Title><Text c="dimmed" size="sm">Build a sales report from any mix of outlets, dates and services. Leave a filter empty to include everything.</Text></div>
    <ReportBuilder outletOptions={outlets} serviceOptions={services} generate={adminBillApi.salesReport} />
  </Stack>
}
