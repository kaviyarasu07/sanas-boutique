import { Card, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'
import type { ComponentType } from 'react'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: ComponentType<IconProps>
}

/** Shared placeholder for admin sections that aren't built yet. */
export function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  return (
    <Stack gap="lg">
      <Title order={2}>{title}</Title>
      <Card withBorder radius="md" p="xl">
        <Stack align="center" gap="sm" py="xl">
          <ThemeIcon size={56} radius="xl" variant="light" color="violet">
            <Icon size={28} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600}>Coming soon</Text>
          <Text c="dimmed" size="sm" ta="center" maw={360}>
            {description}
          </Text>
        </Stack>
      </Card>
    </Stack>
  )
}
