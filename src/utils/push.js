import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Global navigate function reference — set once by App.jsx after router mounts.
 * Allows push.js to perform in-app navigation without importing react-router directly.
 */
let _navigateRef = null;

export const setPushNavigate = (navigateFn) => {
    _navigateRef = navigateFn;
};

/**
 * Foundation for native push notifications.
 * @param {Function} onRegistration - Called with raw FCM/APNs token string.
 * @param {Function} onNotificationReceived - Called with notification payload for foreground alerts.
 */
export const setupPushNotifications = async (onRegistration, onNotificationReceived) => {
    // Push events are not supported in web browsers via Capacitor
    if (Capacitor.getPlatform() === 'web') {
        return null;
    }

    try {
        // 1. Check/Request Permissions
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('Push notification permissions denied by user');
            return null;
        }

        // 2. Register with Apple/Google services
        await PushNotifications.register();

        // 3. Handle Registration Success (Token generation)
        PushNotifications.addListener('registration', (token) => {
            console.log('[Push] Native token generated');
            if (onRegistration) onRegistration(token.value);
        });

        // 4. Handle Registration Errors
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[Push] Registration error:', JSON.stringify(error));
        });

        // 5. Handle Incoming Notifications (Foreground — show in-app toast)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[Push] Foreground notification:', notification.title);
            if (onNotificationReceived) onNotificationReceived(notification);
        });

        // 6. Handle User Tapping a Notification — deep-link into the app
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification.data || {};
            const route = data.route || data.url || null;

            console.log('[Push] Tap action:', action.notification.title, '| route:', route);

            if (route && _navigateRef) {
                // Route should be an internal path like '/assignments', '/courses/abc', etc.
                _navigateRef(route);
            }
        });

    } catch (err) {
        console.error('[Push] Failed to initialize:', err);
    }
};

