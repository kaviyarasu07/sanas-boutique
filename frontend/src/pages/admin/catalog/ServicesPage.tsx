import { useEffect, useState } from 'react'
import { Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Textarea, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconPlus } from '@tabler/icons-react'
import {
  extractErrorMessage,
  billingModuleApi,
  priceUnitApi,
  serviceApi,
  type BillingModule,
  type PriceUnit,
  type Service,
} from '../../../api/catalogApi'
import { BILLING_ICONS } from '../../../config/modules'

interface ServiceFormValues {
  name: string
  description: string
  priceUnitId: string
  newPriceUnitName: string
  /** A built-in module key, `bm:<id>` for a franchisor-created billing module, or NEW_MODULE_VALUE. */
  module: string
  newModuleName: string
  newModuleIcon: string
}

const NEW_PRICE_UNIT_VALUE = '__new__'
const NEW_MODULE_VALUE = '__new_module__'
const moduleValue = (s: Service) => (s.module === 'CUSTOM' && s.billingModuleId ? `bm:${s.billingModuleId}` : s.module ?? 'SALES')

// The outlet module this service opens. Outlets given this service see that module in their menu, with its own billing.
const MODULE_OPTIONS = [
  { value: 'RENTAL', label: 'Jewellery rental (rent by the day, hand over, return)' },
  { value: 'PARLOUR', label: 'Parlour (services, appointments)' },
  { value: 'STITCHING', label: 'Stitching (orders with measurements)' },
  { value: 'SALES', label: 'Shop sales (fabric and other products)' },
]

/**
 * The admin's starting point for the catalog: a blank list of Services
 * (Jewelry Rental, Parlor, Fabric Stitching, ...) with an "Add Service"
 * button. Each service picks its pricing style once, up front; every item
 * created later inside it shares that same price unit. Clicking a row
 * drills into that service's items (ServiceDetailPage).
 */
export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [priceUnits, setPriceUnits] = useState<PriceUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [billingModules, setBillingModules] = useState<BillingModule[]>([])
  const [codePreview, setCodePreview] = useState('')

  const form = useForm<ServiceFormValues>({
    initialValues: { name: '', description: '', priceUnitId: '', newPriceUnitName: '', module: 'SALES', newModuleName: '', newModuleIcon: 'bag' },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      newModuleName: (v, values) => (values.module === NEW_MODULE_VALUE && v.trim().length === 0 ? 'Enter a name for the new billing module' : null),
      priceUnitId: (v, values) =>
        v === NEW_PRICE_UNIT_VALUE
          ? values.newPriceUnitName.trim().length === 0
            ? 'Enter a name for the new price unit'
            : null
          : v
            ? null
            : 'Pricing style is required',
    },
  })

  const loadAll = async () => {
    const [serviceData, priceUnitData, moduleData] = await Promise.all([serviceApi.list(), priceUnitApi.list(), billingModuleApi.list()])
    setServices(serviceData)
    setPriceUnits(priceUnitData)
    setBillingModules(moduleData)
  }

  // Show the bill code a new billing module would get while its name is typed.
  const [debouncedModuleName] = useDebouncedValue(form.values.newModuleName.trim(), 300)
  useEffect(() => {
    if (form.values.module !== NEW_MODULE_VALUE || !debouncedModuleName) { setCodePreview(''); return }
    let cancelled = false
    billingModuleApi.previewCode(debouncedModuleName).then((c) => { if (!cancelled) setCodePreview(c) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [debouncedModuleName, form.values.module])

  // Built-in modules, then the franchisor's billing modules (switched-off ones only when already chosen), then "create".
  const moduleData = [
    { group: 'Built-in modules', items: MODULE_OPTIONS },
    {
      group: 'Your billing modules',
      items: [
        ...billingModules.filter((m) => m.active || form.values.module === `bm:${m.id}`).map((m) => ({ value: `bm:${m.id}`, label: `${m.name} (bills ${m.code})${m.active ? '' : ' · switched off'}` })),
        { value: NEW_MODULE_VALUE, label: '＋ Create a separate billing module…' },
      ],
    },
  ]

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [])

  const openAdd = () => {
    setEditing(null)
    form.setValues({ name: '', description: '', priceUnitId: '', newPriceUnitName: '', module: 'SALES', newModuleName: '', newModuleIcon: 'bag' })
    setFormOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditing(service)
    form.setValues({
      name: service.name,
      description: service.description ?? '',
      priceUnitId: String(service.priceUnitId),
      newPriceUnitName: '',
      module: moduleValue(service),
      newModuleName: '',
      newModuleIcon: 'bag',
    })
    setFormOpen(true)
  }

  const handleSubmit = async (values: ServiceFormValues) => {
    setSubmitting(true)
    try {
      let priceUnitId = Number(values.priceUnitId)
      if (values.priceUnitId === NEW_PRICE_UNIT_VALUE) {
        const created = await priceUnitApi.create({ name: values.newPriceUnitName.trim() })
        priceUnitId = created.id
        setPriceUnits((prev) => [...prev, created])
      }
      // A new billing module is created first, then the service is put in it.
      let module = values.module
      let billingModuleId: number | null = null
      if (values.module === NEW_MODULE_VALUE) {
        const created = await billingModuleApi.create({ name: values.newModuleName.trim(), icon: values.newModuleIcon })
        module = 'CUSTOM'
        billingModuleId = created.id
        notifications.show({ color: 'green', title: 'Billing module created', message: `${created.name} · bills ${created.code}` })
      } else if (values.module.startsWith('bm:')) {
        module = 'CUSTOM'
        billingModuleId = Number(values.module.slice(3))
      }
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        priceUnitId,
        module,
        billingModuleId,
      }
      if (editing) {
        await serviceApi.update(editing.id, payload)
      } else {
        await serviceApi.create(payload)
      }
      await loadAll()
      setFormOpen(false)
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not save service', message: extractErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (service: Service) => {
    if (service.active && !window.confirm(`Disable source service "${service.name}"? It will also be disabled for every outlet.`)) return
    try {
      await serviceApi.setActive(service.id, !service.active)
      await loadAll()
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not update service', message: extractErrorMessage(error) })
    }
  }

  const priceUnitOptions = [
    ...priceUnits.map((u) => ({ value: String(u.id), label: u.name })),
    { value: NEW_PRICE_UNIT_VALUE, label: '+ Create new pricing style…' },
  ]

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={2}>Services</Title>
          <Text c="dimmed" size="sm">
            What your business offers — Jewelry Rental, Parlor, Fabric Stitching, and anything else you add.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add Service
        </Button>
      </Group>

      {!loading && services.length === 0 ? (
        <Text c="dimmed" size="sm">
          No services yet. Click "Add Service" to create your first one.
        </Text>
      ) : (
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Pricing</Table.Th>
              <Table.Th>Items</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {services.map((service) => (
              <Table.Tr key={service.id}>
                <Table.Td>
                  <Text fw={500} size="sm">
                    {service.name}
                  </Text>
                  {service.description && (
                    <Text size="xs" c="dimmed">
                      {service.description}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{service.priceUnitName}</Badge>
                </Table.Td>
                <Table.Td>
                  {service.itemCount}
                </Table.Td>
                <Table.Td>
                  <Switch checked={service.active} onChange={() => toggleActive(service)} size="sm" />
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="subtle" onClick={() => openEdit(service)}>
                    Edit
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit service' : 'Add Service'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <TextInput label="Name" placeholder="e.g. Jewelry Rental" {...form.getInputProps('name')} />
            <Textarea
              label="Description"
              placeholder="Optional"
              autosize
              minRows={1}
              {...form.getInputProps('description')}
            />
            <Select
              label="Pricing style"
              description="How prices are calculated for every item under this service"
              placeholder="Select or create a pricing style"
              data={priceUnitOptions}
              {...form.getInputProps('priceUnitId')}
            />
            {form.values.priceUnitId === NEW_PRICE_UNIT_VALUE && (
              <TextInput
                label="New pricing style name"
                placeholder="e.g. Per Sq. Ft."
                {...form.getInputProps('newPriceUnitName')}
              />
            )}
            <Select
              label="Module"
              description="Which outlet module this service is billed in. Put it inside an existing module, or create a separate billing module."
              data={moduleData}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
              {...form.getInputProps('module')}
            />
            {form.values.module === NEW_MODULE_VALUE && (
              <Card withBorder radius="md" padding="sm">
                <Stack gap="sm">
                  <TextInput label="New module name" description="Shown in the outlet menu" placeholder="e.g. Bangle sales" maxLength={60} {...form.getInputProps('newModuleName')} />
                  <div>
                    <Text size="sm" fw={500} mb={4}>Icon</Text>
                    <SimpleGrid cols={6} spacing="xs">{BILLING_ICONS.map((i) => (
                      <Button key={i.value} variant={form.values.newModuleIcon === i.value ? 'filled' : 'light'} onClick={() => form.setFieldValue('newModuleIcon', i.value)} aria-label={i.label} px={0}>
                        <i.icon size={20} />
                      </Button>
                    ))}</SimpleGrid>
                  </div>
                  <Text size="sm" c="dimmed">
                    {codePreview ? <>Bill numbers will look like <b>ABC-{codePreview}-000123</b> (code made from the name).</> : 'The bill code is made from the name.'}
                  </Text>
                  <Text size="xs" c="dimmed">A simple billing module: pick items, quantity, discount, bill. Prices are fixed. It appears at outlets that are given this service.</Text>
                </Stack>
              </Card>
            )}
            <Button type="submit" loading={submitting} mt="sm">
              {editing ? 'Save changes' : 'Add service'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
