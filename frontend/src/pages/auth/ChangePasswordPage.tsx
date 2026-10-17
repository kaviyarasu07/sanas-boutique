import { useState } from 'react'
import { Alert, Anchor, Button, Container, Paper, PasswordInput, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { Navigate, useNavigate } from 'react-router-dom'
import { changePassword, clearSession, storeSession } from '../../api/authApi'
import { brand } from '../../config/brand'
import { extractErrorMessage, homeFor } from './passwordForms'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const forced = localStorage.getItem('mustChangePassword') === 'true'

  const form = useForm({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (v) => (v.length === 0 ? 'Enter your current password' : null),
      newPassword: (v, values) =>
        v.length < 8 ? 'At least 8 characters' : v === values.currentPassword ? 'Must differ from the current password' : null,
      confirmPassword: (v, values) => (v !== values.newPassword ? 'Passwords do not match' : null),
    },
  })

  if (!localStorage.getItem('accessToken')) return <Navigate to="/login" replace />

  const submit = async (values: typeof form.values) => {
    setSubmitting(true)
    try {
      const auth = await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      storeSession(auth)
      notifications.show({ color: 'green', title: 'Password changed', message: 'Use your new password next time you sign in.' })
      navigate(homeFor(auth.role), { replace: true })
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not change password', message: extractErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{brand.name}</Title>
      <Paper withBorder shadow="sm" p={30} mt={30} radius="md">
        <Title order={4} mb="xs">Change password</Title>
        {forced && (
          <Alert color="orange" mb="md">
            You signed in with a system-generated password. Choose your own password to continue.
          </Alert>
        )}
        <form onSubmit={form.onSubmit(submit)}>
          <PasswordInput label="Current password" {...form.getInputProps('currentPassword')} />
          <PasswordInput label="New password" mt="md" {...form.getInputProps('newPassword')} />
          <PasswordInput label="Confirm new password" mt="md" {...form.getInputProps('confirmPassword')} />
          <Button type="submit" fullWidth mt="xl" loading={submitting}>Change password</Button>
        </form>
        <Text ta="center" size="sm" mt="md">
          <Anchor component="button" type="button" onClick={() => { clearSession(); navigate('/login') }}>Sign out</Anchor>
        </Text>
      </Paper>
    </Container>
  )
}
