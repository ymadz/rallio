import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Input } from '@/components/ui';
import { supabase } from '@/services/supabase';

export default function SignupScreen() {
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateStep1 = () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }
    // Philippine phone validation
    const phoneRegex = /^(\+63|0)?9\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      Alert.alert('Error', 'Please enter a valid Philippine phone number');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSignup = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone.startsWith('+63') ? phone : `+63${phone.replace(/^0/, '')}`,
          },
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Check Your Email',
          'We sent you a verification link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <LinearGradient
        colors={[theme.colors.background.primary, theme.colors.background.secondary]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.header}>
                {step === 2 && (
                  <Pressable onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
                  </Pressable>
                )}
                <Text variant="h3" center>
                  Create Account
                </Text>
                <Text variant="body" color="secondary" center style={styles.subtitle}>
                  {step === 1 ? 'Enter your personal details' : 'Set up your login credentials'}
                </Text>

                {/* Progress Indicator */}
                <View style={styles.progressContainer}>
                  <View style={[styles.progressStep, { backgroundColor: theme.colors.primary.main }]}>
                    <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>1</Text>
                  </View>
                  <View style={[styles.progressLine, { backgroundColor: step === 2 ? theme.colors.primary.main : theme.colors.border.main }]} />
                  <View style={[
                    styles.progressStep,
                    { backgroundColor: step === 2 ? theme.colors.primary.main : theme.colors.background.tertiary }
                  ]}>
                    <Text variant="caption" style={{ color: step === 2 ? '#FFFFFF' : theme.colors.text.muted, fontWeight: '600' }}>2</Text>
                  </View>
                </View>
              </View>

              {/* Step 1: Personal Details */}
              {step === 1 && (
                <View style={styles.form}>
                  <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    leftIcon={
                      <Ionicons name="person-outline" size={20} color={theme.colors.text.muted} />
                    }
                  />

                  <Input
                    label="Phone Number"
                    placeholder="9XX XXX XXXX"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    hint="Philippine number (+63)"
                    leftIcon={
                      <View style={styles.phonePrefix}>
                        <Text variant="body" color="secondary">+63</Text>
                      </View>
                    }
                  />

                  <Button
                    title="Continue"
                    variant="gradient"
                    size="lg"
                    fullWidth
                    onPress={handleNext}
                    rightIcon={<Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
                  />
                </View>
              )}

              {/* Step 2: Account Credentials */}
              {step === 2 && (
                <View style={styles.form}>
                  <Input
                    label="Email"
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    leftIcon={
                      <Ionicons name="mail-outline" size={20} color={theme.colors.text.muted} />
                    }
                  />

                  <Input
                    label="Password"
                    placeholder="Create a password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    hint="At least 6 characters"
                    leftIcon={
                      <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.muted} />
                    }
                    rightIcon={
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={theme.colors.text.muted}
                      />
                    }
                    onRightIconPress={() => setShowPassword(!showPassword)}
                  />

                  <Input
                    label="Confirm Password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    leftIcon={
                      <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.muted} />
                    }
                  />

                  <Button
                    title={isLoading ? 'Creating account...' : 'Create Account'}
                    variant="gradient"
                    size="lg"
                    fullWidth
                    onPress={handleSignup}
                    loading={isLoading}
                  />
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text variant="body" color="secondary">
                  Already have an account?{' '}
                </Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable>
                    <Text variant="body" color="accent" semibold>
                      Sign in
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    marginBottom: 16,
    width: 40,
  },
  subtitle: {
    marginTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  progressStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLine: {
    width: 60,
    height: 2,
    marginHorizontal: 8,
  },
  form: {
    gap: 4,
  },
  phonePrefix: {
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#3D3A5C',
    marginRight: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
});
