import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconBarcode, IconScan, IconSearch } from '@tabler/icons-react'
import axios from 'axios'
import { outletServiceApi, type OutletServiceItem } from '../../api/outletApi'
import { ScanModal } from '../../components/ScanModal'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'found'; item: OutletServiceItem } | { kind: 'missing'; code: string } | { kind: 'error' }

export function PriceCheckPage() {
  const [code, setCode] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [scanOpen, setScanOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])

  const lookup = async (raw: string) => {
    const value = raw.trim()
    if (!value) return
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'found', item: await outletServiceApi.itemByCode(value) })
    } catch (error) {
      setState(axios.isAxiosError(error) && error.response?.status === 404 ? { kind: 'missing', code: value } : { kind: 'error' })
    }
    setCode('')
    input.current?.focus()
  }

  return <Stack gap="lg" maw={560}>
    <div><Title order={2}>Check price</Title><Text c="dimmed">Scan a product barcode to see its price and details.</Text></div>
    <Button size="xl" h={72} leftSection={<IconScan size={28} />} onClick={() => setScanOpen(true)}>Scan with camera</Button>
    <form onSubmit={(e) => { e.preventDefault(); void lookup(code) }}>
      <Group align="end" wrap="nowrap">
        <TextInput ref={input} flex={1} size="lg" label="Using a barcode scanner? Just scan here" placeholder="SB-000123" leftSection={<IconBarcode size={20} />} value={code} onChange={(e) => setCode(e.currentTarget.value)} autoComplete="off" />
        <Button type="submit" size="lg" leftSection={<IconSearch size={18} />}>Find</Button>
      </Group>
    </form>

    {state.kind === 'loading' && <Group justify="center" py="xl"><Loader /><Text c="dimmed">Looking it up…</Text></Group>}
    {state.kind === 'missing' && <Alert color="orange" title="Product not found">We couldn't find a product with the code “{state.code}”. Please check the label and try again.</Alert>}
    {state.kind === 'error' && <Alert color="red" title="Something went wrong">We couldn't check this right now. Please check your internet connection and try again.</Alert>}
    {state.kind === 'idle' && <Text c="dimmed" ta="center" py="xl">Nothing scanned yet.</Text>}
    {state.kind === 'found' && <ProductCard item={state.item} onNext={() => { setState({ kind: 'idle' }); input.current?.focus() }} />}

    <ScanModal opened={scanOpen} onClose={() => setScanOpen(false)} onCode={(c) => void lookup(c)} />
  </Stack>
}

function ProductCard({ item, onNext }: { item: OutletServiceItem; onNext: () => void }) {
  const unavailable = !item.active || !item.allowed
  const stock = item.parentQuantity
  return <Card withBorder padding="lg" radius="md">
    <Stack gap="xs">
      <Group justify="space-between" align="start">
        <Title order={3}>{item.name}</Title>
        {unavailable && <Badge color="red" size="lg">Not available</Badge>}
      </Group>
      <Text c="dimmed">{item.serviceName} · {item.itemCode}</Text>
      <Text fz={40} fw={700} lh={1.1}>₹{Number(item.price).toFixed(2)} <Text span fz="md" c="dimmed" fw={400}>{item.priceUnitName}</Text></Text>
      {stock !== null && <Badge size="lg" variant="light" color={stock > 0 ? 'green' : 'red'}>{stock > 0 ? `${stock} in stock` : 'Out of stock'}</Badge>}
      {item.description && <Text>{item.description}</Text>}
      <Button mt="sm" size="lg" variant="light" onClick={onNext}>Scan another</Button>
    </Stack>
  </Card>
}
