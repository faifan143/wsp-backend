# Notifications Setup Guide

## Firebase Setup

### Backend (NestJS) - Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ispconnect-e408b`
3. Click the gear icon → **Project Settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (e.g., `firebase-admin-sdk.json`)
7. Place it in your project: `config/firebase-admin-sdk.json`
8. Update `.env`:
   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-admin-sdk.json
   ```

### Frontend (React/Vite) - Client Config

Use the config you already have in your React app:

```javascript
// firebase-config.js or similar
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

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
const messaging = getMessaging(app);

// Get FCM token for notifications
export async function getFCMToken() {
  try {
    const token = await getToken(messaging, {
      vapidKey: "YOUR_VAPID_KEY" // Get from Firebase Console → Project Settings → Cloud Messaging
    });
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}
```

## Telegram Setup

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to create bot
4. Copy the token (e.g., `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Update `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

## Complete .env Example

```env
DATABASE_URL=postgresql://postgres:123@localhost:5432/wsp_automation?schema=public
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=1d
NODE_ENV=development
PORT=3002
CORS_ORIGIN=http://localhost:3001

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# Firebase Configuration (Backend - Service Account)
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-admin-sdk.json
```

## Frontend Integration (React/Vite)

1. Install Firebase SDK:
   ```bash
   npm install firebase
   ```

2. Create `src/firebase/config.js`:
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

   // Request notification permission and get token
   export async function requestNotificationPermission() {
     try {
       const permission = await Notification.requestPermission();
       if (permission === 'granted') {
         const vapidKey = "YOUR_VAPID_KEY"; // Get from Firebase Console
         const token = await getToken(messaging, { vapidKey });
         
         // Send token to backend
         await fetch('http://localhost:3002/notifications/register-device', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${yourAuthToken}`
           },
           body: JSON.stringify({
             channel: 'FIREBASE',
             token: token
           })
         });
         
         return token;
       }
     } catch (error) {
       console.error('Error requesting notification permission:', error);
     }
   }

   // Listen for foreground messages
   onMessage(messaging, (payload) => {
     console.log('Message received:', payload);
     // Show notification
     new Notification(payload.notification.title, {
       body: payload.notification.body
     });
   });
   ```

3. Get VAPID Key:
   - Firebase Console → Project Settings → Cloud Messaging
   - Under "Web configuration" → "Web Push certificates"
   - Copy the key pair or generate a new one
