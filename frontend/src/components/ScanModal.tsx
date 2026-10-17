import { useEffect, useRef, useState } from 'react'
import { Alert, Button, FileButton, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconCamera, IconPhoto } from '@tabler/icons-react'
import { BrowserMultiFormatReader } from '@zxing/browser'

/** Browsers only allow the live camera on https (or localhost). Until then the photo option is used. */
const liveCameraAvailable = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

/**
 * Scan a product barcode with the phone camera, a photo of it, or by typing the code.
 * A USB / Bluetooth scanner needs no window at all - it types into the search box.
 */
export function ScanModal({ opened, onClose, onCode }: { opened: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manual, setManual] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const live = liveCameraAvailable()

  const finish = (code: string) => { onClose(); onCode(code.trim()) }

  useEffect(() => {
    if (!opened || !live) return
    setMessage(null)
    const reader = new BrowserMultiFormatReader()
    let stop: (() => void) | undefined
    let cancelled = false
    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _error, controls) => {
        stop = () => controls.stop()
        if (result && !cancelled) { cancelled = true; controls.stop(); finish(result.getText()) }
      })
      .then((controls) => { stop = () => controls.stop(); if (cancelled) controls.stop() })
      .catch(() => setMessage('We could not open the camera. Please allow camera access, or take a photo or type the code below.'))
    return () => { cancelled = true; stop?.() }
    // finish only forwards to props; re-running on it would restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, live])

  const readPhoto = async (file: File | null) => {
    if (!file) return
    setReading(true)
    setMessage(null)
    const url = URL.createObjectURL(file)
    try {
      finish((await new BrowserMultiFormatReader().decodeFromImageUrl(url)).getText())
    } catch {
      setMessage('We could not read a barcode in that photo. Move closer, keep it sharp and straight, and try again.')
    } finally {
      URL.revokeObjectURL(url)
      setReading(false)
    }
  }

  return <Modal opened={opened} onClose={onClose} title="Scan barcode" size="md" fullScreen={window.innerWidth < 600}>
    <Stack>
      {live
        ? <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', minHeight: 200 }} />
        : <Alert color="blue" title="Live scanning is not switched on yet">Take a photo of the barcode instead, or type the code. Live scanning starts working once the app uses a secure (https) address.</Alert>}
      {live && <Text size="sm" c="dimmed">Point the camera at the barcode. It reads by itself.</Text>}
      {message && <Alert color="orange">{message}</Alert>}
      <FileButton onChange={readPhoto} accept="image/*" capture="environment">
        {(props) => <Button {...props} size="lg" variant={live ? 'light' : 'filled'} leftSection={live ? <IconPhoto size={20} /> : <IconCamera size={20} />} loading={reading}>Take a photo of the barcode</Button>}
      </FileButton>
      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) finish(manual) }}>
        <Group align="end" wrap="nowrap">
          <TextInput flex={1} size="md" label="Or type the code" placeholder="SB-000123" value={manual} onChange={(e) => setManual(e.currentTarget.value)} />
          <Button type="submit" size="md">Find</Button>
        </Group>
      </form>
    </Stack>
  </Modal>
}
