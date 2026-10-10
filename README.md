# Chatter Firebase

Chatter Firebase is a Vite + React chat application backed by Firebase Authentication, Firestore, and Storage. Users can create accounts, join password-protected rooms, exchange messages in real time, upload images, and update their profiles.

## Features

- Email/password authentication with Firebase Auth
- Real-time room-based chat with Firestore subscriptions and infinite scroll through older messages
- Create and join password-protected chat rooms (passwords are stored as salted PBKDF2 hashes)
- Edit (shown as "Edited"), delete, and react to messages with emoji
- Image uploads for chat messages with a full-size lightbox viewer
- Room settings: member list, leave room, and delete room (owner only)
- Unread message badges in the room list
- Typing indicators per room
- Toast notifications for errors and confirmations
- Profile editing with avatar upload and image compression
- Light and dark themes (follows the system setting)
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

Then publish the security rules from this repo (they cover room membership, message editing/deleting/reactions and unread markers):

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

You can also paste [firestore.rules](firestore.rules) and [storage.rules](storage.rules) into the Firebase console.

### 3. Run the app

```bash
npm run dev
```

The Vite dev server will start locally and use the Firebase configuration from your environment variables.

## Firebase Data Shape

The app currently uses these top-level collections:

- `users` for user profile data such as `displayName` and `photoURL`
  - `users/{uid}/roomReads/{roomId}` stores when each room was last read (for unread badges)
- `chatRooms` for room metadata, members, and the salted password hash (`passwordHash`, `passwordSalt`, `passwordIterations`)

Each room also contains subcollections:

- `messages` for chat messages (with optional `editedAt` and `reactions`, a map of emoji to user IDs)
- `typing` for active typing state by user

Rooms created before password hashing was added keep working: their plaintext `password` is replaced with a hash the next time someone joins them.

## Deployment Notes

The Vite config uses:

```js
base: "/chatter-firebase/";
```

That matches GitHub Pages deployment for a repository named `chatter-firebase`. If you deploy under a different repository or path, update the `base` value in `vite.config.js` first.

## Notes

This project is structured as a client-only app. Firebase rules are responsible for protecting access to rooms, messages, profile data, and uploaded files.

Room passwords are verified in the browser, so room documents must be readable by signed-in users for the join flow to work. Hashing keeps the plaintext password out of the database, but a determined signed-in user could still attempt an offline guess against the hash. For stronger guarantees, move joining to a Cloud Function.
