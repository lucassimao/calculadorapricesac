import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

const FEEDBACK_EMAIL = 'lucas@lucassimao.com';
const FEEDBACK_SUBJECT = 'Feedback - Calculadora Price & SAC';

const getMailtoUrl = () =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`;

export default function FeedbackScreen() {
  const [attempted, setAttempted] = useState(false);

  const openEmail = async () => {
    const url = getMailtoUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Email indisponível', 'Não foi possível abrir o app de e-mail.');
      return;
    }
    await Linking.openURL(url);
    setAttempted(true);
  };

  useEffect(() => {
    openEmail().catch(() => {});
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Feedback</Text>
      <Text style={styles.subtitle}>
        Escreva sua sugestão, dúvida ou problema direto pelo seu app de e-mail.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{FEEDBACK_EMAIL}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={openEmail}
          accessibilityRole="button"
          accessibilityLabel="Abrir app de e-mail"
        >
          <Text style={styles.primaryButtonText}>
            {attempted ? 'Tentar novamente' : 'Abrir e-mail'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
