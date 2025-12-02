# 🔐 Firebase (Google Auth) Credentials Location

## 📍 Де зберігаються ключі підключення до Firebase

### 🎯 Backend (Server) - Firebase Admin SDK

#### **Метод 1: JSON файл (Поточний спосіб - Рекомендований)**

**Файл:** `server/firebase-service-account.json`

**Розташування:**
```
kbm-logic-v0.1/
└── server/
    └── firebase-service-account.json  ← ТУТ зберігаються ключі
```

**Що містить:**
- `type`: "service_account"
- `project_id`: "kbm-logic"
- `private_key_id`: ID приватного ключа
- `private_key`: Приватний ключ (PEM формат)
- `client_email`: Email сервісного акаунта
- `client_id`: ID клієнта
- `auth_uri`, `token_uri`: OAuth endpoints
- `client_x509_cert_url`: URL сертифіката

**Як отримати:**
1. Відкрийте [Firebase Console](https://console.firebase.google.com/)
2. Виберіть проект `kbm-logic`
3. Перейдіть: **Project Settings** (⚙️) → **Service accounts**
4. Натисніть **Generate new private key**
5. Завантажте JSON файл
6. Перейменуйте в `firebase-service-account.json`
7. Перемістіть в `server/` директорію

---

#### **Метод 2: Environment Variables (Альтернативний)**

**Файл:** `server/.env`

**Змінні оточення:**
```env
FIREBASE_PROJECT_ID=kbm-logic
FIREBASE_PRIVATE_KEY_ID=e7e9c4686bd3aaae8e7280b984af802b43a556b4
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kbm-logic.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=106631631978399169518
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40kbm-logic.iam.gserviceaccount.com
```

**Примітка:** Код автоматично використовує змінні оточення, якщо JSON файл не знайдено.

**Пріоритет:**
1. ✅ Спочатку перевіряється `firebase-service-account.json`
2. ✅ Якщо файл не знайдено → використовуються змінні з `.env`

---

### 🎨 Frontend (Client) - Firebase Client SDK

**Файл:** `client/src/config/firebase.js`

**Поточні значення (hardcoded як fallback):**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAd7TDc3tzlPsBztVnT-7RXD52L94o4FH0",
  authDomain: "kbm-logic.firebaseapp.com",
  projectId: "kbm-logic",
  storageBucket: "kbm-logic.firebasestorage.app",
  messagingSenderId: "849449889272",
  appId: "1:849449889272:web:ced9009c32f01dbb8a7a0d",
  measurementId: "G-7P371KVDHV",
};
```

#### **Метод 1: Environment Variables (Рекомендовано)**

**Файл:** `client/.env` або `client/.env.local`

**Змінні оточення:**
```env
VITE_FIREBASE_API_KEY=AIzaSyAd7TDc3tzlPsBztVnT-7RXD52L94o4FH0
VITE_FIREBASE_AUTH_DOMAIN=kbm-logic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kbm-logic
VITE_FIREBASE_STORAGE_BUCKET=kbm-logic.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=849449889272
VITE_FIREBASE_APP_ID=1:849449889272:web:ced9009c32f01dbb8a7a0d
VITE_FIREBASE_MEASUREMENT_ID=G-7P371KVDHV
```

**Як отримати:**
1. Відкрийте [Firebase Console](https://console.firebase.google.com/)
2. Виберіть проект `kbm-logic`
3. Перейдіть: **Project Settings** (⚙️) → **General**
4. Прокрутіть до секції **"Your apps"**
5. Виберіть Web app (або створіть новий)
6. Скопіюйте значення з `firebaseConfig`

**Примітка:** У коді використовується `import.meta.env.VITE_FIREBASE_*` з fallback на hardcoded значення.

---

## 📂 Структура файлів

```
kbm-logic-v0.1/
├── server/
│   ├── firebase-service-account.json  ← Backend credentials (JSON)
│   ├── .env                            ← Backend env vars (альтернатива)
│   └── config/
│       └── firebase.js                 ← Backend конфігурація
│
└── client/
    ├── .env                            ← Frontend env vars (рекомендовано)
    └── src/
        └── config/
            └── firebase.js             ← Frontend конфігурація
```

---

## 🔒 Безпека

### ✅ Що в `.gitignore`:

```gitignore
# Firebase
*-service-account.json    ← JSON файли з credentials
.env                      ← Environment variables
.env.local
.env.*.local
server/.env
client/.env
```

### ⚠️ Важливо:

1. **`firebase-service-account.json`** - **НЕ комітиться** в Git (в `.gitignore`)
2. **`.env` файли** - **НЕ комітяться** в Git
3. **Hardcoded значення** в `client/src/config/firebase.js` - **комітяться** (це публічні ключі, безпечно)
4. **Приватні ключі** - **НІКОЛИ** не комітити в Git!

---

## 🔍 Як перевірити поточну конфігурацію

### Backend:
```bash
cd server
# Перевірити чи існує JSON файл
ls firebase-service-account.json

# Перевірити змінні оточення
cat .env | grep FIREBASE
```

### Frontend:
```bash
cd client
# Перевірити змінні оточення
cat .env | grep VITE_FIREBASE
```

---

## 📝 Поточна конфігурація

### Backend:
- ✅ **Активний метод:** JSON файл (`firebase-service-account.json`)
- ✅ **Fallback:** Environment variables з `server/.env`
- ✅ **Файл конфігурації:** `server/config/firebase.js`

### Frontend:
- ✅ **Активний метод:** Hardcoded значення (fallback)
- ⚠️ **Рекомендовано:** Environment variables з `client/.env`
- ✅ **Файл конфігурації:** `client/src/config/firebase.js`

---

## 🛠️ Як оновити ключі

### Backend (Service Account):
1. Отримайте новий JSON з Firebase Console
2. Замініть `server/firebase-service-account.json`
3. Або оновіть змінні в `server/.env`

### Frontend (Client Config):
1. Отримайте нові значення з Firebase Console
2. Оновіть `client/.env` файл
3. Або оновіть hardcoded значення в `client/src/config/firebase.js`

---

## 🔗 Корисні посилання

- **Firebase Console:** https://console.firebase.google.com/
- **Project:** kbm-logic
- **Service Accounts:** Project Settings → Service accounts
- **Client Config:** Project Settings → General → Your apps

---

**Останнє оновлення:** $(date)  
**Проект:** kbm-logic  
**Статус:** ✅ Налаштовано

