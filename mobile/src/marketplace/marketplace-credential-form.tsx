import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { MarketplaceActionResult } from '../../../src/shared/marketplace-apps'
import { MarketplaceNotice } from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'

/** Server address and token inputs; the token is a password field and is cleared once saved. */
export function MarketplaceCredentialForm({
  withUrl,
  urlInitial = '',
  submitLabel,
  onSubmit,
  onSaved
}: {
  withUrl: boolean
  urlInitial?: string
  submitLabel: string
  onSubmit: (values: { url: string; token: string }) => Promise<MarketplaceActionResult>
  onSaved: () => void
}) {
  const [url, setUrl] = useState(urlInitial)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const ready = !busy && token.trim() !== '' && (!withUrl || url.trim() !== '')

  const submit = () => {
    if (!ready) {
      return
    }
    setBusy(true)
    setFailure(null)
    void onSubmit({ url: url.trim(), token: token.trim() }).then((result) => {
      setBusy(false)
      if (result.ok) {
        setToken('')
        onSaved()
      } else {
        setFailure(failureMessage(result.reason))
      }
    })
  }

  return (
    <View style={styles.formBlock}>
      {withUrl ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Server address</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Server address"
          />
        </View>
      ) : null}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel="Token"
        />
      </View>
      {failure !== null ? <MarketplaceNotice bad text={failure} /> : null}
      <Pressable
        accessibilityRole="button"
        disabled={!ready}
        style={[
          styles.actionBase,
          styles.actionPrimary,
          styles.actionFull,
          !ready && styles.disabled
        ]}
        onPress={submit}
      >
        <Text style={[styles.actionText, styles.actionPrimaryText]}>{submitLabel}</Text>
      </Pressable>
    </View>
  )
}

function failureMessage(reason: Extract<MarketplaceActionResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'invalid-input':
      return 'The host did not accept these values.'
    case 'vault-unavailable':
      return 'The host vault is not available.'
    case 'unreadable-config':
      return 'An agent config on the host could not be read.'
    case 'unsupported-shape':
      return 'An agent config on the host has a shape MassOrca cannot write to.'
    case 'outside-home':
      return 'An agent config on the host links outside its home, so MassOrca left it alone.'
    case 'host-needs-update':
      return 'Update MassOrca on this host first.'
    case 'unreachable':
      return 'The host cannot be reached.'
    case 'failed':
      return 'The host could not save this.'
  }
}
