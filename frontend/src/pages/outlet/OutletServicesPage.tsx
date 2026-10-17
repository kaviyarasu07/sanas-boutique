import { useEffect, useState } from 'react'
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from 'react-router-dom'
import { extractErrorMessage } from '../../api/catalogApi'
import { outletServiceApi, type OutletService } from '../../api/outletApi'

export function OutletServicesPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState<OutletService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    outletServiceApi.currentServices().then(setServices).catch((error) => notifications.show({ color: 'red', message: extractErrorMessage(error) })).finally(() => setLoading(false))
  }, [])

  return <Stack gap="lg">
    <div><Title order={2}>Services</Title><Text c="dimmed" size="sm">Services enabled for this outlet by the administrator.</Text></div>
    {loading ? <Text c="dimmed">Loading services…</Text> : services.length === 0 ? <Text c="dimmed">No services have been enabled for this outlet.</Text> : <Stack gap="sm">{services.map((service) => <Card key={service.id} withBorder padding="md"><Group justify="space-between"><div><Text fw={600}>{service.name}</Text><Text size="xs" c="dimmed">Price unit: {service.priceUnitName} · {service.itemCount} products</Text></div><Button onClick={() => navigate(`/outlet/services/${service.id}/products`)}>Products</Button></Group></Card>)}</Stack>}
  </Stack>
}
