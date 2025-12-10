# Архітектура та Налаштування

## Технологічний Стек

**KBM Logic v3.1** побудований на стеку **MERN**:

- **MongoDB Atlas** - Хмарна NoSQL база даних
- **Express.js** - Веб-фреймворк для Node.js
- **React 18** - Бібліотека UI з TypeScript
- **Node.js** - Середовище виконання бекенду

### Технології Фронтенду

- **React 18** з TypeScript для типобезпеки
- **Vite** - Сучасний інструмент збірки та dev-сервер
- **Tailwind CSS** - Utility-first CSS фреймворк
- **Shadcn UI** - Бібліотека компонентів на основі Radix UI
- **Recharts** - Візуалізація даних для фінансових графіків
- **Firebase Auth** - Сервіс аутентифікації
- **React Router** - Клієнтська маршрутизація

### Технології Бекенду

- **Express.js** - RESTful API фреймворк
- **Mongoose** - Об'єктне моделювання MongoDB
- **Firebase Admin SDK** - Перевірка токенів
- **bcryptjs** - Хешування паролів
- **express-rate-limit** - Обмеження швидкості API

## Архітектура Бази Даних

### Підключення до MongoDB Atlas

Система підключається до **MongoDB Atlas** використовуючи рядок підключення, збережений у змінній середовища `MONGO_URI`:

```env
MONGO_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority
```

### Розділення Даних

Архітектура бази даних розділяє два типи даних:

1. **Аудит Дані** - Зберігаються в MongoDB для збереження та історичного відстеження
   - Проекти, Задачі, Транзакції, Користувачі
   - Журнали активності та аудит-треки
   - Фінансові снапшоти для розрахунків EVM

2. **Фінансові Дані** - Розраховуються на вимогу з логікою, що враховує розклад
   - PV (Запланована Вартість) - Розраховується з задач та ставок ролей
   - AC (Фактична Вартість) - Нараховується тільки на робочі дні
   - EV (Зароблена Вартість) - На основі виконаних задач

### Обробка Підключення

Система використовує graceful обробку підключення:
- Сервер запускається навіть якщо MongoDB недоступна
- Операції з базою даних не вдаються з логуванням помилок
- Повторні спроби підключення обробляються Mongoose

## Інструкції з Налаштування

### Передумови

- **Node.js** 18+ встановлений
- **MongoDB Atlas** акаунт та кластер
- **Firebase** проект для аутентифікації
- Git (для клонування репозиторію)

### Крок 1: Клонування Репозиторію

```bash
git clone <repository-url>
cd kbm-logic-v0.1
```

### Крок 2: Встановлення Залежностей

Встановіть залежності для root, server та client:

```bash
npm run install:all
```

Або окремо:

```bash
# Root залежності
npm install

# Server залежності
cd server
npm install

# Client залежності
cd ../client
npm install
```

### Крок 3: Конфігурація Середовища

#### Server Environment (`server/.env`)

Створіть `server/.env` з наступними змінними:

```env
# Конфігурація Сервера
PORT=5000
NODE_ENV=development

# Підключення до MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0

# Firebase Admin SDK (для перевірки токенів)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Конфігурація CORS
CORS_ORIGIN=http://localhost:5173
```

**Важливі Примітки:**
- `MONGO_URI` повинен містити назву бази даних (`kbm-logic`)
- Приватний ключ Firebase повинен бути в лапках та містити `\n` для нових рядків
- `CORS_ORIGIN` повинен відповідати URL вашого фронтенду

#### Client Environment (`client/.env`)

Створіть `client/.env` з конфігурацією Firebase:

```env
# Конфігурація API
VITE_API_URL=http://localhost:5000

# Конфігурація Firebase
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Крок 4: Firebase Service Account

Помістіть ваш JSON файл Firebase service account за адресою:
```
server/firebase-service-account.json
```

Цей файл використовується бекендом для перевірки токенів.

### Крок 5: Запуск Серверів Розробки

**Варіант 1: Запустити Обидва Сервери Разом**

З кореневої директорії:

```bash
npm run dev
```

Це запускає Express бекенд (порт 5000) та Vite фронтенд (порт 5173).

**Варіант 2: Запустити Окремо**

Термінал 1 - Бекенд:
```bash
cd server
npm run dev
```

Термінал 2 - Фронтенд:
```bash
cd client
npm run dev
```

### Крок 6: Перевірка Встановлення

1. **Backend Health Check:**
   ```
   GET http://localhost:5000/health
   ```
   Повинен повернути статус підключення до бази даних.

2. **Фронтенд:**
   Перейдіть на `http://localhost:5173`
   Ви повинні побачити сторінку входу.

## Структура Проекту

```
kbm-logic-v0.1/
├── client/                    # React фронтенд
│   ├── src/
│   │   ├── components/        # Переіспользувані UI компоненти
│   │   │   ├── ui/           # Shadcn UI компоненти
│   │   │   ├── settings/     # Компоненти налаштувань
│   │   │   └── modals/       # Модальні діалоги
│   │   ├── pages/            # Сторінки маршрутів
│   │   │   ├── workspace/   # Основні сторінки робочого простору
│   │   │   └── projects/    # Список проектів
│   │   ├── contexts/         # React контексти (Auth, Project)
│   │   ├── services/         # Сервісний шар API
│   │   ├── lib/              # Утилітарні функції
│   │   └── config/           # Файли конфігурації
│   ├── public/               # Статичні ресурси
│   └── package.json
│
├── server/                    # Node.js бекенд
│   ├── controllers/          # Обробники маршрутів
│   ├── models/               # Mongoose схеми
│   ├── services/             # Бізнес-логіка
│   │   ├── evmEngine.js     # Розрахунки EVM
│   │   ├── budgetEngine.js  # Розрахунки бюджету
│   │   └── riskEngine.js    # Розрахунки ризиків
│   ├── middleware/           # Express middleware
│   │   ├── authMiddleware.js # Перевірка токенів Firebase
│   │   ├── rbacMiddleware.js # Контроль доступу на основі ролей
│   │   └── errorHandler.js  # Обробка помилок
│   ├── routes/               # Визначення API маршрутів
│   ├── scripts/              # Скрипти міграції та утиліти
│   │   ├── seed-demo-v3.js  # Генерація демо-проектів
│   │   └── seed-ideal-project.js # Генерація ідеального проєкту з ідеальною S-Кривою
│   ├── config/               # Конфігурація (DB, Firebase)
│   └── package.json
│
├── docs/                     # Англійська документація
│   └── *.md                  # Файли документації
│
├── docs_ukr/                 # Українська документація
│   └── *.md                  # Файли документації
│
└── README.md                  # Двомовна головна сторінка
```

## Робочий Процес Розробки

### Hot Reload

І фронтенд, і бекенд підтримують hot reload:
- **Фронтенд:** Vite HMR (Hot Module Replacement)
- **Бекенд:** Nodemon відстежує зміни файлів

### Розробка API

Бекенд API слідує RESTful конвенціям:
- `GET /api/projects/:projectId/tasks` - Отримати задачі
- `POST /api/projects/:projectId/tasks` - Створити задачу
- `PUT /api/tasks/:taskId` - Оновити задачу
- `DELETE /api/tasks/:taskId` - Видалити задачу

### Обмеження Швидкості

Обмеження швидкості налаштовано в `server/index.js`:
- **Розробка:** 1000 запитів на 15 хвилин (або вимкнено для localhost)
- **Продакшн:** 100 запитів на 15 хвилин

## Усунення Проблем

### Проблеми з Підключенням до MongoDB

**Помилка:** `Failed to connect to MongoDB`

**Рішення:**
1. Перевірте правильність `MONGO_URI` в `server/.env`
2. Перевірте білий список IP MongoDB Atlas (дозвольте `0.0.0.0/0` для розробки)
3. Перевірте права користувача бази даних на читання/запис
4. Перевірте мережеве підключення

### Проблеми з Аутентифікацією Firebase

**Помилка:** `Firebase token verification failed`

**Рішення:**
1. Перевірте наявність `firebase-service-account.json` в `server/`
2. Перевірте облікові дані Firebase Admin SDK в `.env`
3. Переконайтеся, що Firebase project ID збігається у фронтенді та бекенді

### Порт Вже Використовується

**Помилка:** `Port 5000 is already in use`

**Рішення:**
1. Змініть `PORT` в `server/.env` на інший порт (наприклад, 5001)
2. Оновіть `VITE_API_URL` в `client/.env` щоб відповідати
3. Завершіть процес, що використовує порт: `lsof -ti:5000 | xargs kill`

## Генерація Демо-Даних

### Скрипт seed-ideal-project.js

Для створення демонстраційного проєкту з ідеальною S-Кривою (де PV, AC та EV тісно перетинаються), використовуйте:

```bash
node server/scripts/seed-ideal-project.js
```

**Що робить скрипт:**
- Створює проєкт "SaaS Platform 2.0 (Ideal State)"
- Генерує команду з 10 членів з фіксованими ролями
- Створює задачі з salary-driven estimation (EV = AC)
- Встановлює історичні дати завершення для плавного росту EV
- Налаштовує $800,000 початкового фінансування

**Результат:** Проєкт з майже ідеальною S-Кривою, де всі три метрики (PV, AC, EV) тісно перетинаються, демонструючи здорове, передбачуване виконання проєкту.

## Наступні Кроки

Після налаштування, продовжте читання:
- **[Фінансовий Движок](./02-financial-engine.md)** - Розуміння розрахунків PV, AC, EV, BAC
- **[Ролі та Дозволи](./03-roles-and-permissions.md)** - Огляд системи RBAC
- **[Задачі та Робочий Процес](./04-tasks-and-workflow.md)** - Kanban дошка та управління задачами
- **[Схема Бази Даних](./05-database-schema.md)** - Довідник моделей даних

