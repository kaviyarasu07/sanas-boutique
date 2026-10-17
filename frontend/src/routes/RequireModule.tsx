import type { ReactNode } from 'react'
import { Alert, Button, Group, Loader, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { OutletBillingModule, OutletModuleKey } from '../api/outletApi'
import { moduleLabel, useOutletModulesState } from '../config/modules'

/** Shows a module page only when the franchisor gave this outlet that module (the server refuses it anyway). */
export function RequireModule({ module, children }: { module: OutletModuleKey; children: ReactNode }) {
  const { modules, failed, retry } = useOutletModulesState()
  const navigate = useNavigate()
  if (failed) return <Alert color="red" title="Couldn't check your modules" maw={560}>Please check the internet and try again.<Group mt="sm"><Button variant="light" onClick={retry}>Try again</Button></Group></Alert>
  if (modules === null) return <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>
  if (!modules.includes(module))
    return <Alert color="gray" icon={<IconLock size={18} />} title={`${moduleLabel(module)} is not enabled for this outlet`} maw={560}>
      Ask the head office to give your outlet a {moduleLabel(module).toLowerCase()} service.
      <Group mt="sm"><Button variant="light" onClick={() => navigate('/outlet')}>Go to Overview</Button></Group>
    </Alert>
  return <>{children}</>
}

/** A franchisor-created billing module page (/outlet/m/:moduleId), shown only when this outlet was given it. */
export function BillingModuleRoute({ render }: { render: (m: OutletBillingModule) => ReactNode }) {
  const { billingModules, failed, retry } = useOutletModulesState()
  const navigate = useNavigate()
  const id = Number(useParams().moduleId)
  if (failed) return <Alert color="red" title="Couldn't check your modules" maw={560}>Please check the internet and try again.<Group mt="sm"><Button variant="light" onClick={retry}>Try again</Button></Group></Alert>
  if (billingModules === null) return <Group justify="center" py="xl"><Loader size="sm" /><Text c="dimmed">Loading…</Text></Group>
  const m = billingModules.find((x) => x.id === id)
  if (!m)
    return <Alert color="gray" icon={<IconLock size={18} />} title="This module is not enabled for this outlet" maw={560}>
      Ask the head office to give your outlet a service in this module.
      <Group mt="sm"><Button variant="light" onClick={() => navigate('/outlet')}>Go to Overview</Button></Group>
    </Alert>
  return <>{render(m)}</>
}
