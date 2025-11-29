# Firebase Setup Guide

## ✅ Firebase Service Account Configured

The Firebase service account credentials have been set up for project `kbm-logic`.

## Configuration Methods

### Method 1: Service Account JSON File (Current Setup - Recommended)

The `server/firebase-service-account.json` file contains your credentials and is already configured.

**Advantages:**
- Easy to use
- No environment variable escaping needed
- Works immediately

**Security Note:** 
- This file contains sensitive credentials
- For production, consider using environment variables or a secrets manager
- The file is currently in the repo for development convenience

### Method 2: Environment Variables

If you prefer using environment variables, add to `server/.env`:

```env
FIREBASE_PROJECT_ID=kbm-logic
FIREBASE_PRIVATE_KEY_ID=e7e9c4686bd3aaae8e7280b984af802b43a556b4
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kbm-logic.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=106631631978399169518
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40kbm-logic.iam.gserviceaccount.com
```

**Note:** When using environment variables, the code will automatically fall back to them if the JSON file doesn't exist.

## Client-Side Firebase Setup

For the frontend, you need to configure Firebase client SDK. Add to `client/.env`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=kbm-logic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kbm-logic
VITE_FIREBASE_STORAGE_BUCKET=kbm-logic.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Getting Client Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `kbm-logic`
3. Go to Project Settings (gear icon)
4. Scroll to "Your apps" section
5. Click on Web app (or create one)
6. Copy the config values

## Authentication Setup

### Enable Authentication Methods

1. Go to Firebase Console → Authentication
2. Enable the following sign-in methods:
   - **Email/Password** (for email login)
   - **Google** (for Google Sign-In)

### Testing Authentication

The backend will:
1. Verify Firebase ID tokens from the client
2. Sync users to MongoDB on first login
3. Create user records with `role: 'Pending'`

## Security Best Practices

1. **Never commit credentials to Git** (already in .gitignore)
2. **Use environment variables in production**
3. **Rotate keys periodically**
4. **Restrict service account permissions** in Google Cloud Console
5. **Use Firebase App Check** for additional security

## Verification

To verify Firebase is working:

```bash
cd server
npm run dev
```

Check the logs for:
```
[INFO] Firebase Admin initialized from service account file
```

If you see this, Firebase is configured correctly!

## Troubleshooting

### Error: "Failed to initialize Firebase Admin"

- Check that `firebase-service-account.json` exists in `server/` directory
- Verify the JSON file is valid
- Check file permissions

### Error: "Invalid credential"

- Verify the service account key hasn't been rotated
- Check that the project ID matches `kbm-logic`
- Ensure the private key is properly formatted (with `\n` for newlines)

### Error: "Permission denied"

- Verify the service account has the correct IAM roles
- Check Firebase project permissions in Google Cloud Console


