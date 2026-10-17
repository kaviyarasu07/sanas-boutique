import type { CSSProperties, ReactNode } from 'react'
import { Button, Group, Modal, Paper, Portal, ScrollArea, Stack, Text } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { barcodeSvg } from '../barcodeSvg'

/** Shop name and address printed at the top of every paper. */
export interface Shop { name: string; address: string | null }

// One look for every printed paper (stitching receipts, parlour slips, ...): centred shop header,
// thin rules, a clear money box. Sized for the 72 mm print area.
export const rs = {
  paper: { fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45, color: '#111' } as CSSProperties,
  center: { textAlign: 'center' } as CSSProperties,
  shop: { fontSize: 16, fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' } as CSSProperties,
  title: { fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', margin: '6px 0 2px' } as CSSProperties,
  rule: { borderTop: '1px dashed #999', margin: '8px 0' } as CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', gap: 8 } as CSSProperties,
  strong: { fontWeight: 800 } as CSSProperties,
  box: { border: '1.5px solid #111', borderRadius: 6, padding: '6px 8px', margin: '8px 0' } as CSSProperties,
  big: { fontSize: 15, fontWeight: 800 } as CSSProperties,
  muted: { color: '#555', fontSize: 11 } as CSSProperties,
  cut: { borderTop: '2px dashed #999', margin: '14px 0', textAlign: 'center', color: '#777', fontSize: 10 } as CSSProperties,
}

export const ReceiptRow = ({ left, right, style }: { left: ReactNode; right: ReactNode; style?: CSSProperties }) => <div style={{ ...rs.row, ...style }}><span>{left}</span><span>{right}</span></div>
export const ReceiptRule = () => <div style={rs.rule} />

/** Shop header, paper title, number + date, and the number as a barcode (scanned later to open the record). */
export function ReceiptHead({ shop, title, number, date }: { shop: Shop; title: string; number: string; date: string }) {
  return <>
    <div style={rs.shop}>{shop.name}</div>
    {shop.address && <div style={{ ...rs.center, ...rs.muted }}>{shop.address}</div>}
    <ReceiptRule />
    <div style={rs.title}>{title}</div>
    <ReceiptRow left={<span style={rs.strong}>{number}</span>} right={date} />
    <div className="barcode-preview" style={{ height: 34, margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: barcodeSvg(number) }} />
  </>
}

/**
 * Preview a paper on screen, then print. The same content goes into the print-only area, attached
 * to the page (Portal) so an open popup behind it never clips or hides the printout.
 */
export function PaperPreviewModal({ title, opened, onClose, children }: { title: string; opened: boolean; onClose: () => void; children: ReactNode }) {
  return <Modal opened={opened} onClose={onClose} title={title} centered size="md">
    {opened && <Stack>
      <ScrollArea.Autosize mah="60vh"><Paper withBorder shadow="xs" p="md" mx="auto" maw={340} bg="white">{children}</Paper></ScrollArea.Autosize>
      <Text size="xs" c="dimmed" ta="center">Check the details, then print.</Text>
      <Group justify="flex-end"><Button variant="default" onClick={onClose}>Close</Button><Button leftSection={<IconPrinter size={17} />} onClick={() => window.print()}>Print</Button></Group>
      <Portal><div className="print-bill">{children}</div></Portal>
    </Stack>}
  </Modal>
}
