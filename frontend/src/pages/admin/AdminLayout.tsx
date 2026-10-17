import { AppShell, Burger, Group, NavLink, ScrollArea, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBuildingStore,
  IconChartBar,
  IconChartLine,
  IconLayoutDashboard,
  IconLogout,
  IconShirt,
  IconLayoutGrid,
} from '@tabler/icons-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearSession } from '../../api/authApi'
import { brand } from '../../config/brand'

const NAV_ITEMS = [
  { label: 'Overview', path: '/dashboard', icon: IconLayoutDashboard, end: true },
  { label: 'Outlets', path: '/dashboard/outlets', icon: IconBuildingStore },
  { label: 'Services', path: '/dashboard/services', icon: IconShirt },
  { label: 'Billing modules', path: '/dashboard/billing-modules', icon: IconLayoutGrid },
  { label: 'Analytics', path: '/dashboard/analytics', icon: IconChartLine },
  { label: 'Reports', path: '/dashboard/reports', icon: IconChartBar },
]

/**
 * Shell for every admin (franchisor) screen: a collapsible sidebar nav plus
 * a top bar. Each section below routes into its own page via <Outlet />, so
 * new modules (Outlets, Services, Reports, ...) just add a route + nav item
 * here rather than rebuilding the frame.
 */
export function AdminLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false)
  const location = useLocation()
  const navigate = useNavigate()

  const userName = localStorage.getItem('fullName')
  const role = localStorage.getItem('role')

  const handleSignOut = () => {
    clearSession()
    navigate('/')
  }

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path)

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Title order={4} c={`${brand.primaryColor}.7`}>
              {brand.name}
            </Title>
          </Group>
          <Group gap="xs" visibleFrom="xs">
            <Text size="sm" fw={500}>
              {userName ?? 'Admin'}
            </Text>
            <Text size="xs" c="dimmed">
              {role === 'FRANCHISOR' ? 'Franchisor' : role}
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.75} />}
              active={isActive(item.path, item.end)}
              onClick={() => {
                navigate(item.path)
                if (mobileOpened) toggleMobile()
              }}
              mb={4}
              style={{ borderRadius: 8 }}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <NavLink
            label="Sign out"
            leftSection={<IconLogout size={18} stroke={1.75} />}
            onClick={handleSignOut}
            c="red"
            style={{ borderRadius: 8 }}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
