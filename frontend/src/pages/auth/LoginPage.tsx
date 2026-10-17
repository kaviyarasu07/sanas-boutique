import { useState } from 'react'
import { Anchor, Button, Center, Container, Loader, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { login, storeSession } from '../../api/authApi'
import { useSetupStatus } from '../../api/useSetupStatus'
import { brand } from '../../config/brand'

interface LoginFormValues {
  mobileNo: string
  password: string
}

function extractErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message
  }
  return 'Something went wrong. Please try again.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { loading, adminExists } = useSetupStatus()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginFormValues>({
    initialValues: { mobileNo: '', password: '' },
    validate: {
      mobileNo: (value) => (/^\d{7,15}$/.test(value.trim()) ? null : 'Enter your mobile number (digits only)'),
      password: (value) => (value.length === 0 ? 'Enter your password' : null),
    },
  })

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  // Already signed in — go straight to this role's home.
  if (localStorage.getItem('accessToken') && localStorage.getItem('role')) {
    if (localStorage.getItem('mustChangePassword') === 'true') return <Navigate to="/change-password" replace />
    return <Navigate to={localStorage.getItem('role') === 'OUTLET' ? '/outlet' : '/dashboard'} replace />
  }

  // No admin account exists yet — this screen isn't useful until setup runs.
  if (adminExists === false) {
    return <Navigate to="/setup" replace />
  }

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true)
    try {
      const auth = await login({ mobileNo: values.mobileNo.trim(), password: values.password })
      storeSession(auth)
      navigate(auth.mustChangePassword ? '/change-password' : auth.role === 'OUTLET' ? '/outlet' : '/dashboard')
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not sign in',
        message: extractErrorMessage(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{brand.name}</Title>
      <Paper withBorder shadow="sm" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Mobile number"
            placeholder="Your mobile number"
            inputMode="numeric"
            maxLength={15}
            {...form.getInputProps('mobileNo')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            mt="md"
            {...form.getInputProps('password')}
          />
          <Button type="submit" fullWidth mt="xl" loading={submitting}>
            Sign in
          </Button>
          <Text ta="center" size="sm" mt="md">
            <Anchor component={Link} to="/forgot-password">Forgot password?</Anchor>
          </Text>
        </form>
      </Paper>
    </Container>
  )
}
