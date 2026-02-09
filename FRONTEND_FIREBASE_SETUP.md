# Frontend Firebase Notifications Setup (React/Vite)

## 1. Install Firebase SDK

```bash
npm install firebase
```

## 2. Create Firebase Configuration File

Create `src/firebase/config.js`:

```javascript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAX1-0Tsop_TSvEdlSL4PW940VkdVskAVc",
  authDomain: "ispconnect-e408b.firebaseapp.com",
  projectId: "ispconnect-e408b",
  storageBucket: "ispconnect-e408b.firebasestorage.app",
  messagingSenderId: "408221060130",
  appId: "1:408221060130:web:e163777abf1c2e1fcbce7b",
  measurementId: "G-P5ZRTCHXT6"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Get VAPID key from Firebase Console
// Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = "YOUR_VAPID_KEY_HERE";

export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

export function onMessageListener() {
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}
```

## 3. Create Service Worker for Background Notifications

Create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAX1-0Tsop_TSvEdlSL4PW940VkdVskAVc",
  authDomain: "ispconnect-e408b.firebaseapp.com",
  projectId: "ispconnect-e408b",
  storageBucket: "ispconnect-e408b.firebasestorage.app",
  messagingSenderId: "408221060130",
  appId: "1:408221060130:web:e163777abf1c2e1fcbce7b",
  measurementId: "G-P5ZRTCHXT6"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png', // Add your app icon
    badge: '/badge-72x72.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 4. Register Service Worker in Your App

In `src/main.jsx` or `src/App.jsx`:

```javascript
import { useEffect } from 'react';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}
```

## 5. Create Notification Hook

Create `src/hooks/useNotifications.js`:

```javascript
import { useState, useEffect } from 'react';
import { requestNotificationPermission, onMessageListener } from '../firebase/config';
import { useAuth } from './useAuth'; // Your auth hook

export function useNotifications() {
  const [token, setToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const { user, token: authToken } = useAuth(); // Get your auth token

  useEffect(() => {
    async function setupNotifications() {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken && user && authToken) {
        setToken(fcmToken);
        
        // Register token with backend
        try {
          const response = await fetch('http://localhost:3002/notifications/register-device', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              channel: 'FIREBASE',
              token: fcmToken
            })
          });
          
          if (response.ok) {
            console.log('Device registered successfully');
          }
        } catch (error) {
          console.error('Failed to register device:', error);
        }
      }
    }

    if (user) {
      setupNotifications();
    }
  }, [user, authToken]);

  useEffect(() => {
    // Listen for foreground messages
    onMessageListener()
      .then((payload) => {
        setNotification(payload);
        // Show notification
        if (payload.notification) {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/icon-192x192.png'
          });
        }
      })
      .catch((err) => console.log('Error listening for messages:', err));
  }, []);

  return { token, notification };
}
```

## 6. Use in Your Component

In your main component or layout:

```javascript
import { useNotifications } from './hooks/useNotifications';

function App() {
  const { token, notification } = useNotifications();

  useEffect(() => {
    if (notification) {
      // Handle notification
      console.log('New notification:', notification);
      // You can show a toast, update state, etc.
    }
  }, [notification]);

  return (
    <div>
      {/* Your app content */}
      {token && <div>Notifications enabled</div>}
    </div>
  );
}
```

## 7. Get VAPID Key from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ispconnect-e408b`
3. Click **Project Settings** (gear icon)
4. Go to **Cloud Messaging** tab
5. Under **Web Push certificates**, click **Generate key pair**
6. Copy the key and replace `YOUR_VAPID_KEY_HERE` in `config.js`

## 8. Update vite.config.js (if needed)

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Ensure service worker is served correctly
  publicDir: 'public',
});
```

## 9. Test Notifications

1. Start your React app
2. Grant notification permission when prompted
3. Check browser console for FCM token
4. Use backend endpoint to send test notification:
   ```bash
   POST http://localhost:3002/notifications
   {
     "type": "ALERT",
     "channel": "FIREBASE",
     "title": "Test Notification",
     "message": "This is a test",
     "firebaseToken": "YOUR_FCM_TOKEN_FROM_CONSOLE"
   }
   ```

## Complete Example Component

```javascript
import { useEffect, useState } from 'react';
import { useNotifications } from './hooks/useNotifications';

function NotificationExample() {
  const { token, notification } = useNotifications();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (notification) {
      setNotifications((prev) => [notification, ...prev]);
    }
  }, [notification]);

  return (
    <div>
      <h2>Notifications</h2>
      {token ? (
        <div>
          <p>✅ Notifications enabled</p>
          <p>Token: {token.substring(0, 20)}...</p>
        </div>
      ) : (
        <p>❌ Notifications not enabled</p>
      )}
      
      <div>
        <h3>Recent Notifications:</h3>
        {notifications.map((notif, index) => (
          <div key={index}>
            <strong>{notif.notification?.title}</strong>
            <p>{notif.notification?.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationExample;
```

## Troubleshooting

- **Service Worker not registering**: Make sure `firebase-messaging-sw.js` is in the `public` folder
- **Token not generated**: Check browser console for errors, ensure HTTPS (or localhost)
- **Notifications not received**: Verify token is registered with backend, check FCM token validity
- **Background notifications not working**: Ensure service worker is properly registered and active
