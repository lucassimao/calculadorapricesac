import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { BrandProfile } from '../../types/brand-profile';
import {
  EMPTY_BRAND_PROFILE,
  getBrandProfileAnalyticsProperties,
  getBrandProfileCompletion,
  getBrandProfileIdentityProperties,
  isBrandProfileComplete,
  normalizeBrandProfile,
} from '../../types/brand-profile';
import {
  clearBrandProfile,
  loadBrandProfile,
  saveBrandProfile,
} from '../../lib/storage/brand-profile';
import {
  analyticsEnabled,
  identifyUser,
  registerAnalyticsProperties,
  resetAnalyticsIdentity,
  trackEvent,
} from '../../lib/analytics';

interface BrandProfileCardProps {
  isPremium: boolean;
}

export function BrandProfileCard({ isPremium }: BrandProfileCardProps) {
  const [profile, setProfile] = useState<BrandProfile>(EMPTY_BRAND_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const completion = getBrandProfileCompletion(profile);

  useEffect(() => {
    let active = true;

    loadBrandProfile()
      .then((storedProfile) => {
        if (active) setProfile(storedProfile);
      })
      .catch(() => {
        if (active) setMessage('Não foi possível carregar o perfil profissional.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (field: keyof BrandProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const pickLogo = async () => {
    if (!isPremium) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      setMessage('Não foi possível ler a imagem selecionada.');
      return;
    }

    const nextProfile = normalizeBrandProfile({
      ...profile,
      logoDataUri: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`,
    });
    trackEvent('professional_profile_logo_selected', {
      ...getBrandProfileAnalyticsProperties(nextProfile),
      professional_profile_logo_mime_type: asset.mimeType ?? 'image/jpeg',
    });
    setProfile((current) => ({
      ...current,
      logoDataUri: nextProfile.logoDataUri,
    }));
    setMessage(null);
  };

  const removeLogo = () => {
    const nextProfile = normalizeBrandProfile({ ...profile, logoDataUri: undefined });
    trackEvent('professional_profile_logo_removed', {
      ...getBrandProfileAnalyticsProperties(nextProfile),
      professional_profile_had_logo: Boolean(profile.logoDataUri),
    });
    setProfile((current) => ({ ...current, logoDataUri: undefined }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!isPremium || saving) return;

    const normalized = normalizeBrandProfile(profile);
    if (!isBrandProfileComplete(normalized)) {
      setMessage('Preencha nome ou empresa e pelo menos um contato.');
      trackEvent(
        'professional_profile_save_blocked_incomplete',
        getBrandProfileAnalyticsProperties(normalized),
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBrandProfile(normalized);
      setProfile(saved);
      setMessage('Perfil profissional salvo.');
      const analyticsProperties = getBrandProfileAnalyticsProperties(saved);
      registerAnalyticsProperties(analyticsProperties);
      if (analyticsEnabled()) {
        await identifyUser(getBrandProfileIdentityProperties(saved)).catch(() => {});
      }
      trackEvent('professional_profile_saved', analyticsProperties);
    } catch {
      setMessage('Não foi possível salvar o perfil profissional.');
      trackEvent(
        'professional_profile_save_failed',
        getBrandProfileAnalyticsProperties(normalized),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (!isPremium || saving) return;

    Alert.alert('Limpar perfil profissional', 'Isso remove os dados salvos neste dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: () => {
          void clearProfile();
        },
      },
    ]);
  };

  const clearProfile = async () => {
    setSaving(true);
    try {
      const priorAnalyticsProperties = getBrandProfileAnalyticsProperties(profile);
      const clearedProfile = await clearBrandProfile();
      setProfile(clearedProfile);
      setMessage('Perfil profissional removido.');
      // Reset before tracking so the cleared event lands on a fresh anon id, not the prior identified user.
      resetAnalyticsIdentity();
      trackEvent('professional_profile_cleared', priorAnalyticsProperties);
    } catch {
      setMessage('Não foi possível limpar o perfil profissional.');
      trackEvent('professional_profile_clear_failed');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !isPremium || loading || saving;

  return (
    <View style={[styles.card, !isPremium && styles.lockedCard]} testID="professional-profile-card">
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Perfil profissional</Text>
          <Text style={styles.helper}>
            Personalize o PDF Profissional com sua marca, contatos e dados comerciais.
          </Text>
        </View>
        <View style={[styles.statusPill, completion.isComplete && styles.statusPillComplete]}>
          <Text
            style={[styles.statusPillText, completion.isComplete && styles.statusPillTextComplete]}
            testID="professional-profile-status"
          >
            {completion.isComplete ? 'Completo' : 'Incompleto'}
          </Text>
        </View>
      </View>

      {!isPremium ? (
        <View style={styles.lockedNotice} testID="professional-profile-locked">
          <Text style={styles.lockedNoticeTitle}>Disponível no Premium</Text>
          <Text style={styles.lockedNoticeText}>
            Configure este perfil para gerar relatórios em PDF com aparência profissional: capa
            personalizada, seus contatos, registro profissional e cor da sua marca.
          </Text>
          <Text style={styles.lockedNoticeText}>
            Usuários gratuitos podem visualizar o recurso, mas a configuração e o PDF Profissional
            ficam bloqueados até ativar o Premium.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.helper}>Carregando perfil...</Text>
        </View>
      ) : (
        <>
          <View style={styles.logoRow}>
            <View style={styles.logoPreview} testID="professional-profile-logo-preview">
              {profile.logoDataUri ? (
                <Image source={{ uri: profile.logoDataUri }} style={styles.logoImage} />
              ) : (
                <Text style={styles.logoPlaceholder}>Logo</Text>
              )}
            </View>
            <View style={styles.logoActions}>
              <Pressable
                style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
                onPress={pickLogo}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Selecionar logo profissional"
                testID="professional-profile-pick-logo"
              >
                <Text style={styles.secondaryButtonText}>Selecionar logo</Text>
              </Pressable>
              {profile.logoDataUri ? (
                <Pressable
                  style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
                  onPress={removeLogo}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Remover logo profissional"
                  testID="professional-profile-remove-logo"
                >
                  <Text style={styles.secondaryButtonText}>Remover</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={styles.requirementText}>
            Obrigatório: nome/empresa e pelo menos um contato (telefone, email ou website).
          </Text>

          <Text style={styles.fieldLabel}>Nome ou empresa *</Text>
          <TextInput
            style={[styles.input, disabled && styles.inputDisabled]}
            value={profile.nameOrCompany}
            onChangeText={(value) => updateField('nameOrCompany', value)}
            placeholder="Ex.: Prime Crédito"
            editable={!disabled}
            testID="professional-profile-name"
            accessibilityLabel="Nome ou empresa do perfil profissional"
          />
          <Text style={styles.fieldLabel}>Registro profissional (opcional)</Text>
          <TextInput
            style={[styles.input, disabled && styles.inputDisabled]}
            value={profile.registration}
            onChangeText={(value) => updateField('registration', value)}
            placeholder="CRECI, CFP ou registro"
            editable={!disabled}
            testID="professional-profile-registration"
            accessibilityLabel="Registro profissional"
          />
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Telefone **</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={profile.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="(11) 99999-0000"
                keyboardType="phone-pad"
                editable={!disabled}
                testID="professional-profile-phone"
                accessibilityLabel="Telefone profissional"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email **</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={profile.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="contato@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!disabled}
                testID="professional-profile-email"
                accessibilityLabel="Email profissional"
              />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Website **</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={profile.website}
                onChangeText={(value) => updateField('website', value)}
                placeholder="www.empresa.com"
                autoCapitalize="none"
                editable={!disabled}
                testID="professional-profile-website"
                accessibilityLabel="Website profissional"
              />
            </View>
            <View style={styles.colorFieldGroup}>
              <Text style={styles.fieldLabel}>Cor (opcional)</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={profile.accentColor}
                onChangeText={(value) => updateField('accentColor', value)}
                placeholder="#2563EB"
                autoCapitalize="characters"
                editable={!disabled}
                testID="professional-profile-accent-color"
                accessibilityLabel="Cor de destaque do perfil profissional"
              />
            </View>
          </View>
          <Text style={styles.requirementHint}>
            * obrigatório. ** preencha pelo menos um destes contatos.
          </Text>

          {message ? (
            <Text
              style={[
                styles.message,
                (message.includes('salvo') || message.includes('removido')) &&
                  styles.successMessage,
              ]}
              testID="professional-profile-message"
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.primaryButton, styles.actionButton, disabled && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Salvar perfil profissional"
              testID="professional-profile-save"
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Salvando...' : 'Salvar perfil'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                styles.actionButton,
                styles.dangerButton,
                disabled && styles.buttonDisabled,
              ]}
              onPress={handleClear}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Limpar perfil profissional"
              testID="professional-profile-clear"
            >
              <Text style={[styles.secondaryButtonText, styles.dangerButtonText]}>Limpar</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  lockedCard: {
    opacity: 0.95,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  helper: {
    fontSize: 12,
    lineHeight: 17,
    color: '#6B7280',
  },
  requirementText: {
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    padding: 10,
    color: '#374151',
    fontSize: 12,
    lineHeight: 17,
  },
  requirementHint: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 15,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: -6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FEF3C7',
  },
  statusPillComplete: {
    backgroundColor: '#D1FAE5',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  statusPillTextComplete: {
    color: '#065F46',
  },
  lockedNotice: {
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    gap: 6,
  },
  lockedNoticeTitle: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedNoticeText: {
    color: '#1D4ED8',
    fontSize: 12,
    lineHeight: 17,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  logoPreview: {
    width: 76,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  logoPlaceholder: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  logoActions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldGroup: {
    flex: 1,
    minWidth: 140,
    gap: 8,
  },
  colorFieldGroup: {
    width: 112,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  message: {
    fontSize: 12,
    color: '#B91C1C',
  },
  successMessage: {
    color: '#047857',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: 132,
  },
  dangerButton: {
    borderColor: '#FCA5A5',
  },
  dangerButtonText: {
    color: '#B91C1C',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
