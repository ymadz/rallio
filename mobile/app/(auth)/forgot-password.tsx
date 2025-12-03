import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'rallio://reset-password',
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  if (emailSent) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0D0B1A', '#1A1625', '#0D0B1A']}
          style={styles.gradient}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.successContainer}>
              {/* Success Icon */}
              <View style={styles.successIconContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#A78BFA']}
                  style={styles.successIconGradient}
                >
                  <Ionicons name="mail" size={48} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Success Message */}
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password reset link to
              </Text>
              <Text style={styles.emailText}>{email}</Text>
              <Text style={styles.successHint}>
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </Text>

              {/* Actions */}
              <View style={styles.successActions}>
                <Button
                  title="Back to Login"
                  onPress={handleBackToLogin}
                  variant="primary"
                  size="lg"
                  fullWidth
                />
                <TouchableOpacity 
                  style={styles.resendButton}
                  onPress={() => setEmailSent(false)}
                >
                  <Text style={styles.resendText}>
                    Didn't receive email? <Text style={styles.resendLink}>Try again</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0B1A', '#1A1625', '#0D0B1A']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back Button */}
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleBackToLogin}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Header Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="key" size={32} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>
                  No worries! Enter your email address and we'll send you a link to reset your password.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Input
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon={
                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                  }
                />

                <Button
                  title={isLoading ? 'Sending...' : 'Send Reset Link'}
                  onPress={handleResetPassword}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading || !email}
                />
              </View>

              {/* Back to Login */}
              <TouchableOpacity 
                style={styles.loginLink}
                onPress={handleBackToLogin}
              >
                <Ionicons name="arrow-back" size={16} color="#8B5CF6" />
                <Text style={styles.loginLinkText}>Back to Login</Text>
              </TouchableOpacity>
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
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: 15,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  // Success state styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconContainer: {
    marginBottom: 32,
  },
  successIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  successHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  successActions: {
    width: '100%',
    marginTop: 40,
    gap: 16,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  resendLink: {
    color: '#8B5CF6',
    fontWeight: '500',
  },
});
