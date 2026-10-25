import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_AUTH_LOCK = 'escanear_ine_auth_lock';

/**
 * Checks if the user has enabled app lock protection
 */
export function isSecurityLockEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY_AUTH_LOCK) === 'true';
}

/**
 * Sets app lock state
 */
export function setSecurityLockEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(STORAGE_KEY_AUTH_LOCK, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_AUTH_LOCK);
  }
}

/**
 * Checks if biometric or device credential (PIN/pattern/face/fingerprint) is available
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompts the native Android/iOS biometric/PIN authentication dialog
 */
export async function authenticateDeviceUser(
  reason = 'Desbloquea para ver tus documentos protegidos'
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // In web/desktop development mode, allow instant bypass
    return true;
  }

  try {
    const info = await BiometricAuth.checkBiometry();
    if (info.isAvailable) {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true, // Allows native PIN, Pattern, Fingerprint or Face ID
        iosFallbackTitle: 'Usar código',
      });
      return true;
    }
    return true;
  } catch (err) {
    console.warn('Biometric authentication failed or cancelled:', err);
    return false;
  }
}
