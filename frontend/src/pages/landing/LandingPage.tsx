import {
  Box,
  Button,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { brand } from '../../config/brand'

interface Feature {
  title: string
  description: string
}

const features: Feature[] = [
  {
    title: 'Jewellery rental',
    description: 'Track pieces out on rent, availability and return dates in one place.',
  },
  {
    title: 'Parlour services',
    description: 'Book and bill parlour services without juggling a separate register.',
  },
  {
    title: 'Stitching orders',
    description: 'Follow every order from received to delivered, with clear status at a glance.',
  },
  {
    title: 'Fabric sales',
    description: 'Sell fabric with stock that updates itself as you bill.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <Box>
      {/* Header */}
      <Container size="lg" py="md">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} size="xl" c={`${brand.primaryColor}.7`}>
            {brand.name}
          </Text>
          <Button variant="light" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </Group>
      </Container>

      {/* Hero */}
      <Container size="md" py={{ base: 40, sm: 80 }}>
        <Stack align="center" gap="lg" ta="center">
          <Title
            order={1}
            fz={{ base: rem(32), sm: rem(44) }}
            maw={640}
            lh={1.15}
          >
            One place to run billing, stock and sales across every outlet
          </Title>
          <Text c="dimmed" fz={{ base: 'md', sm: 'lg' }} maw={560}>
            {brand.tagline}
          </Text>
          <Group gap="sm" mt="sm">
            <Button size="lg" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </Group>
        </Stack>
      </Container>

      {/* Feature grid */}
      <Container size="lg" py={{ base: 30, sm: 50 }}>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg">
          {features.map((feature) => (
            <Stack key={feature.title} gap={4} p="md">
              <Text fw={600} size="lg">
                {feature.title}
              </Text>
              <Text c="dimmed" size="sm">
                {feature.description}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>

      {/* Owner vs franchisor */}
      <Box bg="gray.0">
        <Container size="lg" py={{ base: 40, sm: 60 }}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 'xl', sm: 50 }}>
            <Stack gap="xs">
              <Text fw={700} size="lg">
                For each outlet
              </Text>
              <Text c="dimmed">
                Front-desk staff see only their own franchise — billing,
                stock and orders, nothing more to get lost in.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Text fw={700} size="lg">
                For the franchisor
              </Text>
              <Text c="dimmed">
                One dashboard across every outlet, so growth stays visible
                as new franchises come on board.
              </Text>
            </Stack>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Footer */}
      <Container size="lg" py="lg">
        <Text c="dimmed" size="sm" ta="center">
          © {new Date().getFullYear()} {brand.name}
        </Text>
      </Container>
    </Box>
  )
}
