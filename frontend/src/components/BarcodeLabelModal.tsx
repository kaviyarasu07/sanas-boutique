import { useState } from 'react'
import { Button, Group, Modal, NumberInput, Stack, Text } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { labelSize } from '../config/label'
import type { OutletServiceItem } from '../api/outletApi'
import { barcodeSvg } from './barcodeSvg'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function Label({ item }: { item: OutletServiceItem }) {
  return <div style={{ width: `${labelSize.widthMm}mm`, height: `${labelSize.heightMm}mm`, boxSizing: 'border-box', padding: '1.5mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'white', color: 'black', border: '1px dashed #bbb' }}>
    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.1, overflow: 'hidden', maxHeight: '2.4em' }}>{item.name}</div>
    <div className="barcode-preview" style={{ height: '10mm' }} dangerouslySetInnerHTML={{ __html: barcodeSvg(item.itemCode ?? '') }} />
    <div style={{ fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>{item.itemCode}</div>
  </div>
}

/** Prints through a hidden frame so no pop-up window is needed. */
function printLabels(items: OutletServiceItem[], copies: number) {
  const labels = items
    .flatMap((item) => Array.from({ length: copies }, () => `<div class="label"><div class="name">${escapeHtml(item.name)}</div><div class="bars">${barcodeSvg(item.itemCode ?? '')}</div><div class="code">${escapeHtml(item.itemCode ?? '')}</div></div>`))
    .join('')
  const html = `<!doctype html><html><head><title>Barcode labels</title><style>
    @page { size: ${labelSize.widthMm}mm ${labelSize.heightMm}mm; margin: 0 }
    body { margin: 0; font-family: Arial, sans-serif }
    .label { width: ${labelSize.widthMm}mm; height: ${labelSize.heightMm}mm; box-sizing: border-box; padding: 1.5mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; overflow: hidden }
    .name { font-size: 11px; font-weight: 600; line-height: 1.1; max-height: 2.4em; overflow: hidden }
    .bars { height: 10mm } .bars svg { width: 100%; height: 100% }
    .code { font-size: 10px; text-align: center; letter-spacing: 1px }
  </style></head><body>${labels}</body></html>`
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) { frame.remove(); return }
  doc.open(); doc.write(html); doc.close()
  frame.contentWindow.focus()
  setTimeout(() => { frame.contentWindow?.print(); setTimeout(() => frame.remove(), 1000) }, 200)
}

export function BarcodeLabelModal({ items, opened, onClose }: { items: OutletServiceItem[]; opened: boolean; onClose: () => void }) {
  const [copies, setCopies] = useState<number | string>(1)
  const printable = items.filter((i) => i.itemCode)
  const count = Math.max(1, Math.min(100, Number(copies) || 1))
  const total = printable.length * count

  return <Modal opened={opened} onClose={onClose} title="Barcode label" size="md">
    <Stack>
      {printable.length === 0
        ? <Text c="dimmed">These products do not have a barcode yet. Please save the product again and try once more.</Text>
        : <>
          <Text size="sm" c="dimmed">The barcode only holds the product code. When you scan it, the screen shows the latest price.</Text>
          <Stack gap="xs" align="center" mah={300} style={{ overflowY: 'auto' }}>
            {printable.slice(0, 3).map((i) => <Label key={i.id} item={i} />)}
            {printable.length > 3 && <Text size="sm" c="dimmed">and {printable.length - 3} more…</Text>}
          </Stack>
          <NumberInput label="How many labels of each product?" min={1} max={100} value={copies} onChange={setCopies} size="md" />
          <Group justify="end">
            <Button variant="default" size="md" onClick={onClose}>Close</Button>
            <Button size="md" leftSection={<IconPrinter size={18} />} onClick={() => printLabels(printable, count)}>Print {total} {total === 1 ? 'label' : 'labels'}</Button>
          </Group>
        </>}
    </Stack>
  </Modal>
}
