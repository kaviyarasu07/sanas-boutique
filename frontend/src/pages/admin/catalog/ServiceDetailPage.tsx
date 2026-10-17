import { useEffect, useState } from 'react'
import { Breadcrumbs, Stack, Text, Title } from '@mantine/core'
import { Link, useParams } from 'react-router-dom'
import { serviceApi, type Service } from '../../../api/catalogApi'

/**
 * A service is controlled by the admin only. Products (with their own prices
 * and stock) belong to each outlet, so they are viewed per outlet under
 * Outlets -> Manage services -> View products, never edited here.
 */
export function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const id = Number(serviceId)
  const [service, setService] = useState<Service | null>(null)

  useEffect(() => {
    serviceApi.list().then((all) => setService(all.find((s) => s.id === id) ?? null)).catch(() => undefined)
  }, [id])

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Text component={Link} to="/dashboard/services" size="sm" c="dimmed">
          Services
        </Text>
        <Text size="sm">{service?.name ?? '…'}</Text>
      </Breadcrumbs>
      <div>
        <Title order={2}>{service?.name ?? 'Service'}</Title>
        {service && (
          <Text c="dimmed" size="sm">
            Priced {service.priceUnitName.toLowerCase()}
            {service.description ? ` · ${service.description}` : ''}
          </Text>
        )}
      </div>
      <Text c="dimmed" size="sm">
        Each outlet adds its own products and prices under this service. To see an outlet's products, open{' '}
        <Text component={Link} to="/dashboard/outlets" size="sm" span>
          Outlets
        </Text>{' '}
        and choose "Manage services" then "View products".
      </Text>
    </Stack>
  )
}
