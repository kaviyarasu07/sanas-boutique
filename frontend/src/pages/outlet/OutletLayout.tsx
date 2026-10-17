import { useState } from 'react'
import { ProfileModal } from '../../components/ProfileModal'
import { Alert, AppShell, Burger, Button, Divider, Group, NavLink, ScrollArea, Skeleton, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBarcode, IconLayoutDashboard, IconLogout, IconPackages, IconUsers, IconChartBar, IconChartLine, type Icon } from '@tabler/icons-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearSession } from '../../api/authApi'
import { brand } from '../../config/brand'
import { MODULES, billingIcon, billingModulePath, resetOutletModules, useOutletModulesState } from '../../config/modules'

/** Screens every outlet has; the modules (rental, parlour, stitching, shop sales) are added per outlet. */
const SHARED_ITEMS = [
  { label: 'Customers', path: '/outlet/customers', icon: IconUsers },
  { label: 'Services & products', path: '/outlet/services', icon: IconPackages },
  { label: 'Check price', path: '/outlet/price-check', icon: IconBarcode },
  { label: 'Analytics', path: '/outlet/analytics', icon: IconChartLine },
  { label: 'Reports', path: '/outlet/reports', icon: IconChartBar },
]

export function OutletLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [, refresh] = useState(0)
  const userName = localStorage.getItem('fullName')
  // Only the modules of the services the franchisor gave this outlet.
  const { modules, billingModules, failed, retry } = useOutletModulesState()

  const isActive = (path: string, end?: boolean) => end ? location.pathname === path : location.pathname.startsWith(path)
  const go = (path: string) => { navigate(path); if (mobileOpened) toggleMobile() }
  const link = (item: { label: string; path: string; icon: Icon; end?: boolean }) =>
    <NavLink key={item.path} label={item.label} leftSection={<item.icon size={18} stroke={1.75} />} active={isActive(item.path, item.end)} onClick={() => go(item.path)} mb={4} style={{ borderRadius: 8 }} />

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm"><Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" /><Title order={4} c={`${brand.primaryColor}.7`}>{brand.name}</Title></Group>
          <Button variant="subtle" size="compact-md" onClick={() => setProfileOpen(true)}>{userName ?? 'My account'}</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {link({ label: 'Overview', path: '/outlet', icon: IconLayoutDashboard, end: true })}
          {failed
            ? <Alert color="red" variant="light" p="xs" my={4}><Text size="sm">Couldn't load your modules.</Text><Button size="compact-sm" variant="light" mt={4} onClick={retry}>Try again</Button></Alert>
            : modules === null || billingModules === null
              ? <><Skeleton h={36} mb={4} radius="md" /><Skeleton h={36} mb={4} radius="md" /></>
              : modules.length + billingModules.length === 0
                ? <Text size="sm" c="dimmed" px="sm" py={6}>No modules yet. Ask the head office to give your outlet a service.</Text>
                : <>
                  {MODULES.filter((m) => modules.includes(m.key)).map(link)}
                  {/* Billing modules created by the franchisor, each with its own bills. */}
                  {billingModules.map((m) => link({ label: m.name, path: billingModulePath(m.id), icon: billingIcon(m.icon) }))}
                </>}
          <Divider my="xs" />
          {SHARED_ITEMS.map(link)}
        </AppShell.Section>
        <AppShell.Section><NavLink label="Sign out" leftSection={<IconLogout size={18} stroke={1.75} />} onClick={() => { clearSession(); resetOutletModules(); navigate('/') }} c="red" style={{ borderRadius: 8 }} /></AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main><Outlet /></AppShell.Main>
      <ProfileModal opened={profileOpen} onClose={() => setProfileOpen(false)} onChanged={() => refresh((n) => n + 1)} />
    </AppShell>
  )
}
