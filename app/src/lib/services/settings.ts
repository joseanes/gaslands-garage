import { auth, db } from '../firebase';
import { browser } from '$app/environment';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// Interface for user settings
export interface UserSettings {
  enableSponsorships: boolean;
  includeAdvanced: boolean;
  darkMode: boolean;
  printStyle?: string;
  showTeamSummary?: boolean;
  showGaslandsMath?: boolean;
}

// Default settings
export const DEFAULT_SETTINGS: UserSettings = {
  enableSponsorships: true,
  includeAdvanced: true,
  darkMode: false,
  printStyle: 'classic',
  showTeamSummary: true,
  showGaslandsMath: true
};

/**
 * Save user settings to Firestore
 */
export async function saveUserSettings(settings: UserSettings): Promise<{ success: boolean; error?: any }> {
  try {
    if (!browser) return { success: false, error: 'Not in browser environment' };
    if (!auth.currentUser) return { success: false, error: 'User not authenticated' };

    const userId = auth.currentUser.uid;
    await setDoc(doc(db, 'userSettings', userId), settings);
    return { success: true };
  } catch (error) {
    console.error('Error saving user settings:', error);
    return { success: false, error };
  }
}

/**
 * Get user settings from Firestore, create defaults if none exist
 */
export async function getUserSettings(): Promise<{ success: boolean; settings?: UserSettings; error?: any }> {
  try {
    if (!browser) return { success: false, error: 'Not in browser environment', settings: DEFAULT_SETTINGS };
    if (!auth?.currentUser) return { success: false, error: 'User not authenticated', settings: DEFAULT_SETTINGS };

    const userId = auth.currentUser.uid;
    const settingsSnapshot = await getDoc(doc(db, 'userSettings', userId));
    
    if (settingsSnapshot.exists()) {
      const data = settingsSnapshot.data() as UserSettings;
      return { success: true, settings: data };
    } else {
      // Create default settings if none exist
      await saveUserSettings(DEFAULT_SETTINGS);
      return { success: true, settings: DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.error('Error getting user settings:', error);
    return { success: false, error, settings: DEFAULT_SETTINGS };
  }
}