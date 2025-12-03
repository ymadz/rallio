/**
 * Authentication service - mobile
 * Handles signup, login, OAuth, password reset, profile setup
 */

import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export type SignUpData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type SignInData = {
  email: string;
  password: string;
};

export type ProfileSetupData = {
  skillLevel?: number; // 1-10
  playStyle?: string; // 'aggressive' | 'defensive' | 'balanced'
  preferredPosition?: string; // 'front' | 'back' | 'any'
  bio?: string;
  avatarUri?: string;
};

/**
 * Sign up with email and password
 */
export async function signUp(data: SignUpData) {
  const { email, password, firstName, lastName } = data;

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (authError) throw authError;

  // Profile will be created automatically by the database trigger (handle_new_user)
  // No need to manually insert into profiles or players tables

  return authData;
}

/**
 * Sign in with email and password
 */
export async function signIn(data: SignInData) {
  const { email, password } = data;

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return authData;
}

/**
 * Sign in with Google OAuth (mobile)
 */
export async function signInWithGoogle() {
  // Note: Requires proper OAuth setup in Supabase and Expo config
  // For mobile, you'll need to use a library like expo-auth-session
  // or expo-google-app-auth

  // Placeholder implementation
  throw new Error('Google OAuth not yet implemented for mobile');
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'rallio://reset-password', // Deep link for mobile
  });

  if (error) throw error;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/**
 * Complete profile setup
 * Updates profiles and players tables
 */
export async function completeProfileSetup(userId: string, data: ProfileSetupData) {
  let avatarUrl: string | null = null;

  // Upload avatar if provided
  if (data.avatarUri) {
    avatarUrl = await uploadAvatar(userId, data.avatarUri);
  }

  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (profileError) throw profileError;

  // Update player details
  const { error: playerError } = await supabase
    .from('players')
    .update({
      skill_level: data.skillLevel,
      play_style: data.playStyle,
      preferred_position: data.preferredPosition,
      bio: data.bio,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (playerError) throw playerError;
}

/**
 * Upload avatar to Supabase Storage
 */
export async function uploadAvatar(userId: string, imageUri: string): Promise<string> {
  // Convert image URI to blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const fileExt = imageUri.split('.').pop() || 'jpg';
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, {
      contentType: `image/${fileExt}`,
      upsert: true,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick image from camera
 */
export async function pickImageFromCamera(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return null;

  return result.assets[0].uri;
}

/**
 * Pick image from library
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) return null;

  return result.assets[0].uri;
}
