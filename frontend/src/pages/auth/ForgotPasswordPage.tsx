import { useState } from 'react'
import { Alert, Anchor, Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordOtp, resetPassword, type OtpResponse } from '../../api/authApi'
import { brand } from '../../config/brand'
import { extractErrorMessage } from './passwordForms'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [otpInfo, setOtpInfo] = useState<OtpResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const form = useForm({
    initialValues: { mobileNo: '', otp: '', newPassword: '', confirmPassword: '' },
    validate: {
      mobileNo: (v) => (/^\d{7,15}$/.test(v.trim()) ? null : 'Enter your mobile number'),
      otp: (v) => (otpInfo && !/^\d{6}$/.test(v) ? 'Enter the 6-digit OTP' : null),
      newPassword: (v) => (otpInfo && v.length < 8 ? 'At least 8 characters' : null),
      confirmPassword: (v, values) => (otpInfo && v !== values.newPassword ? 'Passwords do not match' : null),
    },
  })

  const sendOtp = async () => {
    setBusy(true)
    try {
      setOtpInfo(await requestPasswordOtp(form.values.mobileNo.trim()))
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not send OTP', message: extractErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const submit = async (values: typeof form.values) => {
    if (!otpInfo) return sendOtp()
    setBusy(true)
    try {
      await resetPassword({ mobileNo: values.mobileNo.trim(), otp: values.otp, newPassword: values.newPassword })
      notifications.show({ color: 'green', title: 'Password changed', message: 'Sign in with your new password.' })
      navigate('/login', { replace: true })
    } catch (error) {
      notifications.show({ color: 'red', title: 'Could not reset password', message: extractErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{brand.name}</Title>
      <Paper withBorder shadow="sm" p={30} mt={30} radius="md">
        <Title order={4} mb="md">Forgot password</Title>
        <form onSubmit={form.onSubmit(submit)}>
          <TextInput label="Mobile number" placeholder="Your registered mobile number" inputMode="numeric" maxLength={15} disabled={otpInfo !== null} {...form.getInputProps('mobileNo')} />
          {otpInfo && (
            <>
              {otpInfo.otp && (
                <Alert color="blue" mt="md" title="Your OTP">
                  <Text fw={700} size="xl" style={{ letterSpacing: 4 }}>{otpInfo.otp}</Text>
                  <Text size="xs">Shown here for now; it will be sent by SMS later. Valid for {otpInfo.validForMinutes} minutes.</Text>
                </Alert>
              )}
              <TextInput label="OTP" placeholder="6-digit OTP" mt="md" inputMode="numeric" maxLength={6} {...form.getInputProps('otp')} />
              <PasswordInput label="New password" mt="md" {...form.getInputProps('newPassword')} />
              <PasswordInput label="Confirm new password" mt="md" {...form.getInputProps('confirmPassword')} />
            </>
          )}
          <Button type="submit" fullWidth mt="xl" loading={busy}>{otpInfo ? 'Change password' : 'Get OTP'}</Button>
        </form>
        <Text ta="center" size="sm" mt="md"><Anchor component={Link} to="/login">Back to sign in</Anchor></Text>
      </Paper>
    </Container>
  )
}
