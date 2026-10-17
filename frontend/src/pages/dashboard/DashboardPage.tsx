import { Button, Container, Group, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { clearSession } from '../../api/authApi'

export function DashboardPage() {
  const navigate = useNavigate()
  const fullName = localStorage.getItem('fullName')
  const role = localStorage.getItem('role')

  const handleSignOut = () => {
    clearSession()
    navigate('/')
  }

  return (
    <Container size="lg" my={40}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" mt="sm">
            Signed in as {fullName ?? 'unknown'} ({role ?? 'unknown role'}).
            Placeholder — will show per-franchise or cross-franchise summary
            depending on the signed-in role.
          </Text>
        </div>
        <Button variant="subtle" onClick={handleSignOut}>
          Sign out
        </Button>
      </Group>
    </Container>
  )
}
