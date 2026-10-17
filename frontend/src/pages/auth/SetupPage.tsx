import { useState } from 'react'
import {
  Anchor,
  Button,
  Center,
  Container,
  Loader,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { Navigate, useNavigate } from 'react-router-dom'
import { setupAdmin, storeSession } from '../../api/authApi'
import { useSetupStatus } from '../../api/useSetupStatus'
import { brand } from '../../config/brand'

interface SetupFormValues {
  fullName: string
  username: string
  mobileNo: string
  password: string
  confirmPassword: string
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

export function SetupPage() {
  const navigate = useNavigate()
  const { loading, adminExists } = useSetupStatus()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<SetupFormValues>({
    initialValues: { fullName: '', username: '', mobileNo: '', password: '', confirmPassword: '' },
    validate: {
      fullName: (value) => (value.trim().length === 0 ? 'Enter your name' : null),
      username: (value) => (value.trim().length < 3 ? 'At least 3 characters' : null),
      mobileNo: (value) => (/^[0-9]{10}$/.test(value.trim()) ? null : 'Enter a 10-digit mobile number'),
      password: (value) => (value.length < 8 ? 'At least 8 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords do not match' : null,
    },
  })

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  // Setup already done elsewhere — this screen isn't valid any more.
  if (adminExists) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (values: SetupFormValues) => {
    setSubmitting(true)
    try {
      const auth = await setupAdmin({
        fullName: values.fullName.trim(),
        username: values.username.trim(),
        mobileNo: values.mobileNo.trim(),
        password: values.password,
      })
      storeSession(auth)
      notifications.show({
        color: 'green',
        title: 'Account created',
        message: `Welcome, ${auth.fullName}.`,
      })
      navigate('/dashboard')
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not create account',
        message: extractErrorMessage(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{brand.name}</Title>
      <Text c="dimmed" size="sm" ta="center" mt={4}>
        Set up the admin account — this only happens once.
      </Text>
      <Paper withBorder shadow="sm" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Your name"
            placeholder="e.g. Sana"
            {...form.getInputProps('fullName')}
          />
          <TextInput
            label="Username"
            placeholder="Choose a username"
            mt="md"
            {...form.getInputProps('username')}
          />
          <TextInput
            label="Mobile number"
            placeholder="10-digit mobile number"
            type="tel"
            mt="md"
            {...form.getInputProps('mobileNo')}
          />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            mt="md"
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="Type it again"
            mt="md"
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth mt="xl" loading={submitting}>
            Create admin account
          </Button>
        </form>
      </Paper>
      <Text c="dimmed" size="sm" ta="center" mt="md">
        Already set up?{' '}
        <Anchor size="sm" onClick={() => navigate('/login')}>
          Sign in instead
        </Anchor>
      </Text>
    </Container>
  )
}
