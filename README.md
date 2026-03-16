# Chatter Firebase

Chatter Firebase is a Vite + React chat application backed by Firebase Authentication, Firestore, and Storage. Users can create accounts, join password-protected rooms, exchange messages in real time, upload images, and update their profiles.

## Features

- Email/password authentication with Firebase Auth
- Real-time room-based chat with Firestore subscriptions
- Create and join password-protected chat rooms
- Typing indicators per room
- Image uploads for chat messages
- Profile editing with avatar upload and image compression
- GitHub Pages deployment support

## Tech Stack

- React 19
- Vite 7
- Firebase 12
- Sass
- Compressor.js for profile image compression

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Create a `.env.local` file in the project root and add your Firebase web app credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Enable these Firebase services in your project:

- Authentication with the Email/Password provider
- Cloud Firestore
- Cloud Storage

### 3. Run the app

```bash
npm run dev
```

The Vite dev server will start locally and use the Firebase configuration from your environment variables.

## Firebase Data Shape

The app currently uses these top-level collections:

- `users` for user profile data such as `displayName` and `photoURL`
- `chatRooms` for room metadata, members, and room passwords

Each room also contains subcollections:

- `messages` for chat messages
- `typing` for active typing state by user

## Deployment Notes

The Vite config uses:

```js
base: "/chatter-firebase/";
```

That matches GitHub Pages deployment for a repository named `chatter-firebase`. If you deploy under a different repository or path, update the `base` value in `vite.config.js` first.

## Notes

This project is structured as a client-only app. Firebase rules are responsible for protecting access to rooms, messages, profile data, and uploaded files.
