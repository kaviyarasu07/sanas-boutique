import { useEffect, useState } from 'react'
import { Stack, Text, Title } from '@mantine/core'
import { outletServiceApi } from '../../api/outletApi'
import { ReportBuilder } from '../../components/ReportBuilder'

/** Outlet sales reports; always limited to the signed-in outlet by the server. */
export function OutletReportsPage() {
  const [services, setServices] = useState<{ value: string; label: string }[]>([])
  useEffect(() => { outletServiceApi.currentServices().then((all) => setServices(all.filter((s) => s.allowed).map((s) => ({ value: String(s.id), label: s.name })))).catch(() => undefined) }, [])
  return <Stack gap="lg">
    <div><Title order={2}>Reports</Title><Text c="dimmed" size="sm">Build a sales report for this outlet by date and service, then download it.</Text></div>
    <ReportBuilder serviceOptions={services} generate={outletServiceApi.salesReport} />
  </Stack>
}
