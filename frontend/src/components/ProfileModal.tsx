import { useEffect, useState } from 'react'
import { Button, Divider, Modal, PasswordInput, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconLock } from '@tabler/icons-react'
import { changePassword, getProfile, storeSession } from '../api/authApi'
import { outletServiceApi } from '../api/outletApi'
import { extractErrorMessage } from '../pages/auth/passwordForms'

/**
 * "My details". Outlet login: outlet name and mobile number are view-only; owner name,
 * address and email can be edited. Admin login: name and mobile only. Both can change password.
 */
export function ProfileModal({ opened, onClose, onChanged }: { opened: boolean; onClose: () => void; onChanged: () => void }) {
  const isOutlet = localStorage.getItem('role') === 'OUTLET'
  const [fixed, setFixed] = useState({ name: '', mobile: '' })
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const detailsForm = useForm({
    initialValues: { ownerName: '', address: '', email: '' },
    validate: {
      ownerName: (v) => (v.trim() ? null : 'Owner name is required'),
      email: (v) => (/^\S+@\S+$/.test(v.trim()) ? null : 'Enter a valid email'),
    },
  })
  const passwordForm = useForm({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (v) => (v ? null : 'Enter your current password'),
      newPassword: (v, values) => (v.length < 8 ? 'At least 8 characters' : v === values.currentPassword ? 'Must differ from the current password' : null),
      confirmPassword: (v, values) => (v !== values.newPassword ? 'Passwords do not match' : null),
    },
  })

  useEffect(() => {
    if (!opened) return
    passwordForm.reset()
    const fail = (e: unknown) => notifications.show({ color: 'red', title: 'Could not load your details', message: extractErrorMessage(e) })
    if (isOutlet) {
      outletServiceApi.current()
        .then((o) => { setFixed({ name: o.name, mobile: o.mobileNumber }); detailsForm.setValues({ ownerName: o.ownerName, address: o.address ?? '', email: o.email }) })
        .catch(fail)
    } else {
      getProfile().then((p) => setFixed({ name: p.fullName, mobile: p.mobileNo })).catch(fail)
    }
    // Reload only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const saveDetails = async (values: { ownerName: string; address: string; email: string }) => {
    setSavingDetails(true)
    try {
      const saved = await outletServiceApi.updateCurrent({ ownerName: values.ownerName.trim(), address: values.address.trim() || undefined, email: values.email.trim() })
      localStorage.setItem('fullName', saved.ownerName)
      notifications.show({ color: 'green', message: 'Details updated' })
      onChanged()
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not save details', message: extractErrorMessage(e) })
    } finally { setSavingDetails(false) }
  }

  const savePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setSavingPassword(true)
    try {
      storeSession(await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }))
      passwordForm.reset()
      notifications.show({ color: 'green', message: 'Password changed' })
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not change password', message: extractErrorMessage(e) })
    } finally { setSavingPassword(false) }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isOutlet ? 'Outlet details' : 'My details'} centered>
      <Stack>
        <TextInput label={isOutlet ? 'Outlet name' : 'Name'} value={fixed.name} readOnly disabled leftSection={<IconLock size={14} />} />
        <TextInput label="Mobile number" value={fixed.mobile} readOnly disabled leftSection={<IconLock size={14} />} />
        {isOutlet && (
          <form onSubmit={detailsForm.onSubmit(saveDetails)}>
            <Stack gap="xs">
              <TextInput label="Owner name" {...detailsForm.getInputProps('ownerName')} />
              <Textarea label="Address" autosize minRows={2} {...detailsForm.getInputProps('address')} />
              <TextInput label="Email" type="email" {...detailsForm.getInputProps('email')} />
              <Text size="xs" c="dimmed">Outlet name and mobile number can only be changed by the admin.</Text>
              <Button type="submit" variant="light" loading={savingDetails}>Save details</Button>
            </Stack>
          </form>
        )}
        <Divider label="Change password" />
        <form onSubmit={passwordForm.onSubmit(savePassword)}>
          <Stack gap="xs">
            <PasswordInput label="Current password" {...passwordForm.getInputProps('currentPassword')} />
            <PasswordInput label="New password" {...passwordForm.getInputProps('newPassword')} />
            <PasswordInput label="Confirm new password" {...passwordForm.getInputProps('confirmPassword')} />
            <Button type="submit" loading={savingPassword}>Change password</Button>
          </Stack>
        </form>
      </Stack>
    </Modal>
  )
}
