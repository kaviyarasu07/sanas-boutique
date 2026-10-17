import { Card, Stack, Text, Title } from '@mantine/core'

export function OutletModulePage({ title, description }: { title: string; description: string }) {
  return <Stack gap="lg"><div><Title order={2}>{title}</Title><Text c="dimmed" size="sm">{description}</Text></div><Card withBorder><Text c="dimmed">This module is ready for the outlet workflow. No records have been added yet.</Text></Card></Stack>
}
