import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Haptic feedback utility for mobile devices
 */
export const triggerImpact = async (style = ImpactStyle.Medium) => {
    try {
        await Haptics.impact({ style });
    } catch (e) {
        // Fallback for non-mobile platforms
    }
};

export const triggerSuccess = async () => {
    try {
        await Haptics.notification({ type: 'SUCCESS' });
    } catch (e) {
        // Fallback
    }
};

export const triggerWarning = async () => {
    try {
        await Haptics.notification({ type: 'WARNING' });
    } catch (e) {
        // Fallback
    }
};

export const triggerError = async () => {
    try {
        await Haptics.notification({ type: 'ERROR' });
    } catch (e) {
        // Fallback
    }
};

export const triggerSelection = async () => {
    try {
        await Haptics.selectionStart();
    } catch (e) {
        // Fallback
    }
};
