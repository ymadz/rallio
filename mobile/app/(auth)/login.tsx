import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Input } from '@/components/ui';
import { supabase } from '@/services/supabase';

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // TODO: Implement Google OAuth
    Alert.alert('Coming Soon', 'Google login will be available soon');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <LinearGradient
        colors={[theme.colors.background.primary, theme.colors.background.secondary]}
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
              {/* Header/Logo Section */}
              <View style={styles.header}>
                <View style={[styles.logoContainer, { backgroundColor: theme.colors.primary.main }]}>
                  <Ionicons name="tennisball" size={40} color="#FFFFFF" />
                </View>
                <Text variant="h2" center style={styles.title}>
                  Rallio
                </Text>
                <Text variant="body" color="secondary" center style={styles.subtitle}>
                  Find courts. Join queues. Play more.
                </Text>
              </View>

              {/* Form Section */}
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
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
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

                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable style={styles.forgotPassword}>
                    <Text variant="bodySmall" color="accent">
                      Forgot password?
                    </Text>
                  </Pressable>
                </Link>

                <Button
                  title={isLoading ? 'Signing in...' : 'Sign In'}
                  variant="gradient"
                  size="lg"
                  fullWidth
                  onPress={handleLogin}
                  loading={isLoading}
                />

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border.main }]} />
                  <Text variant="caption" color="muted" style={styles.dividerText}>
                    or continue with
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border.main }]} />
                </View>

                {/* Social Login */}
                <Pressable
                  style={[styles.socialButton, { borderColor: theme.colors.border.main }]}
                  onPress={handleGoogleLogin}
                >
                  <Ionicons name="logo-google" size={20} color={theme.colors.text.primary} />
                  <Text variant="body" style={styles.socialButtonText}>
                    Continue with Google
                  </Text>
                </Pressable>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text variant="body" color="secondary">
                  Don't have an account?{' '}
                </Text>
                <Link href="/(auth)/signup" asChild>
                  <Pressable>
                    <Text variant="body" color="accent" semibold>
                      Sign up
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
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginTop: 4,
  },
  form: {
    gap: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  socialButtonText: {
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
});
