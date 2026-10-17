import { useEffect, useState } from 'react'
import { Badge, Button, Card, Checkbox, Group, Modal, NumberInput, Pagination, Stack, Switch, Table, Text, TextInput, Textarea, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconBarcode, IconEdit, IconPlus, IconSearch } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { extractErrorMessage } from '../../api/catalogApi'
import { BarcodeLabelModal } from '../../components/BarcodeLabelModal'
import { outletServiceApi, type OutletService, type OutletServiceItem, type OutletServiceItemPage } from '../../api/outletApi'

/** replacementValue: "Value if lost" of one piece (jewellery rental only); pre-fills the missing charge at a return. */
interface ItemForm { name: string; description: string; price: number | string; quantity: number | string; replacementValue: number | string }

export function OutletProductsPage() {
  const navigate = useNavigate()
  const { serviceId } = useParams<{ serviceId: string }>()
  const id = Number(serviceId)
  const [service, setService] = useState<OutletService | null>(null)
  const [items, setItems] = useState<OutletServiceItemPage | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OutletServiceItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Record<number, OutletServiceItem>>({})
  const [labelItems, setLabelItems] = useState<OutletServiceItem[] | null>(null)
  const selectedItems = Object.values(selected)
  const toggleSelected = (item: OutletServiceItem) => setSelected((old) => { const next = { ...old }; if (next[item.id]) delete next[item.id]; else next[item.id] = item; return next })
  const form = useForm<ItemForm>({ initialValues: { name: '', description: '', price: '', quantity: '', replacementValue: '' }, validate: { name: (v) => (String(v).trim() ? null : 'Product name is required'), price: (v) => (Number(v) >= 0 ? null : 'Enter a valid price'), quantity: (v) => (v === '' || Number(v) >= 0 ? null : 'Quantity cannot be negative') } })

  const loadItems = async (nextPage = page, nextSearch = search) => {
    try { setItems(await outletServiceApi.listCurrentItems(id, nextSearch, nextPage, 50)); setPage(nextPage) } catch (error) { notifications.show({ color: 'red', message: extractErrorMessage(error) }) }
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return
    Promise.all([outletServiceApi.currentServices(), loadItems(0, '')]).then(([services]) => setService(services.find((item) => item.id === id) ?? null)).finally(() => setLoading(false))
    // The service ID comes from this page's route and controls the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const toggleActive = async (item: OutletServiceItem) => { try { await outletServiceApi.setCurrentItemActive(id, item.id, !item.active); await loadItems(page, search) } catch (error) { notifications.show({ color: 'red', message: extractErrorMessage(error) }) } }
  const openAdd = () => { setEditing(null); form.setValues({ name: '', description: '', price: '', quantity: '', replacementValue: '' }); setModalOpen(true) }
  const openEdit = (item: OutletServiceItem) => { setEditing(item); form.setValues({ name: item.name, description: item.description ?? '', price: item.price, quantity: item.parentQuantity ?? '', replacementValue: item.replacementValue ?? '' }); setModalOpen(true) }
  const submit = async (values: ItemForm) => {
    const payload = { name: String(values.name).trim(), description: values.description.trim() || undefined, price: Number(values.price), quantity: values.quantity === '' ? undefined : Number(values.quantity), replacementValue: values.replacementValue === '' ? null : Number(values.replacementValue) }
    setSaving(true)
    try { if (editing) await outletServiceApi.updateCurrentItem(id, editing.id, payload); else await outletServiceApi.createCurrentItem(id, payload); setModalOpen(false); await loadItems(editing ? page : 0, search) } catch (error) { notifications.show({ color: 'red', title: 'Could not save product', message: extractErrorMessage(error) }) } finally { setSaving(false) }
  }

  return <Stack gap="lg">
    <Group><Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/outlet/services')}>Services</Button><Text c="dimmed">/</Text><Text>{service?.name ?? 'Products'}</Text></Group>
    <Group justify="space-between" align="end"><div><Title order={2}>{service?.name ?? 'Products'}</Title><Text c="dimmed" size="sm">Price unit fixed by admin: {service?.priceUnitName ?? '—'}</Text></div><Group>{selectedItems.length > 0 && <Button variant="light" leftSection={<IconBarcode size={16} />} onClick={() => setLabelItems(selectedItems)}>Print barcodes ({selectedItems.length})</Button>}<Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add product</Button></Group></Group>
    <Card withBorder><Group align="end" mb="md"><TextInput flex={1} label="Search products" placeholder="Name, product ID, or barcode" leftSection={<IconSearch size={17} />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadItems(0, search) }} /><Button variant="light" onClick={() => void loadItems(0, search)}>Search</Button></Group>{loading ? <Text c="dimmed">Loading products…</Text> : !items || items.content.length === 0 ? <Text c="dimmed" size="sm">No products found.</Text> : <><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th w={40} /><Table.Th>Product</Table.Th><Table.Th>Code / barcode</Table.Th><Table.Th>Price</Table.Th><Table.Th>Quantity</Table.Th><Table.Th>Active</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{items.content.map((item) => <Table.Tr key={item.id}><Table.Td><Checkbox aria-label={`Select ${item.name}`} checked={!!selected[item.id]} onChange={() => toggleSelected(item)} /></Table.Td><Table.Td><Text fw={500}>{item.name}</Text><Text size="xs" c="dimmed">{item.description}</Text></Table.Td><Table.Td><Badge variant="light">{item.itemCode ?? '—'}</Badge></Table.Td><Table.Td>₹{item.price} <Text span size="xs" c="dimmed">/ {item.priceUnitName}</Text></Table.Td><Table.Td>{item.parentQuantity ?? '—'}</Table.Td><Table.Td><Switch size="sm" checked={item.active} onChange={() => void toggleActive(item)} /></Table.Td><Table.Td><Group gap={4} wrap="nowrap"><Button size="xs" variant="light" leftSection={<IconBarcode size={14} />} onClick={() => setLabelItems([item])}>Make barcode</Button><Button size="xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => openEdit(item)}>Edit</Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table>{items.totalPages > 1 && <Pagination value={page + 1} total={items.totalPages} onChange={(next) => void loadItems(next - 1, search)} />}</>}</Card>
    <BarcodeLabelModal items={labelItems ?? []} opened={labelItems !== null} onClose={() => setLabelItems(null)} />
    <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit product' : 'Add product'}><form onSubmit={form.onSubmit(submit)}><Stack><TextInput label="Product name" {...form.getInputProps('name')} /><Textarea label="Description" autosize minRows={1} {...form.getInputProps('description')} /><Group grow><NumberInput label={`Price (${service?.priceUnitName ?? ''})`} min={0} {...form.getInputProps('price')} /><NumberInput label="Quantity" description="Leave blank when stock is not tracked" min={0} {...form.getInputProps('quantity')} /></Group>{service?.module === 'RENTAL' && <NumberInput label="Value if lost (per piece)" description="Used as the missing charge when a piece is not returned. Optional." prefix="₹" min={0} decimalScale={2} {...form.getInputProps('replacementValue')} />}<Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Add product'}</Button></Stack></form></Modal>
  </Stack>
}
