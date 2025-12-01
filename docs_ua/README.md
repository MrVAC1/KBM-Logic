# KBM Logic

Гібридна система управління проектами, що поєднує простоту Kanban з фінансовим контролем підприємницького рівня.

---

## Огляд

KBM Logic — це full-stack MERN додаток, створений для команд, яким потрібні як гнучке управління завданнями (Kanban-дошки), так і складний фінансовий відстеження (S-крива бюджетування, Earned Value Management). Система має динамічний розрахунок ризиків, контроль доступу на основі ролей та відстеження активності в реальному часі.

### Ключові функції

- **Управління завданнями Kanban** - Візуальні дошки завдань з drag-and-drop робочим процесом
- **Движок динамічних ризиків** - Автоматична корекція оцінок ризиків на основі дедлайнів і бюджету
- **Бюджетування S-кривою** - Криві запланованої вартості з відстеженням фактичних витрат
- **Шлюз доступу** - Статуси Гостя/Очікування з безпечним режимом перегляду
- **Контроль доступу на основі ролей** - Детальні дозволи для кожного члена проекту
- **Відстеження часу** - Логування годин з розрахунком вартості
- **Стрічка активності** - Відстеження активності проекту в реальному часі

---

## Технологічний стек

### Frontend
- **React 18** - UI бібліотека
- **TypeScript** - Типізація
- **Vite** - Інструмент збірки
- **Tailwind CSS** - Стилізація
- **Recharts** - Візуалізація даних (криві бюджету, графіки)
- **Firebase Auth** - Аутентифікація
- **React Router** - Навігація
- **Shadcn UI** - Бібліотека компонентів

### Backend
- **Node.js** - Середовище виконання
- **Express** - Web-фреймворк
- **MongoDB** - База даних
- **Mongoose** - ODM
- **Firebase Admin** - Перевірка токенів
- **bcryptjs** - Хешування паролів

---

## Швидкий старт

### Передумови

- Node.js 18+ 
- MongoDB (локальна або хмарна інстанція)
- Firebase проект (для аутентифікації)

### Встановлення

1. **Встановити всі залежності** (root, server, і client):
```bash
npm run install:all
```

2. **Налаштувати змінні середовища**:

Створити `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/kbm-logic
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

Створити `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Запуск серверів розробки

**Варіант 1: Запустити server і client разом**
```bash
npm run dev
```

**Варіант 2: Запустити окремо**

Термінал 1 - Server:
```bash
npm run dev:server
```

Термінал 2 - Client:
```bash
npm run dev:client
```

Додаток буде доступний за адресами:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## Структура проекту

```
kbm-logic-v0.1/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI компоненти
│   │   ├── pages/          # Сторінки маршрутів
│   │   ├── contexts/       # React контексти
│   │   ├── services/       # API сервіси
│   │   └── lib/            # Утиліти
│   └── package.json
├── server/                 # Node.js backend
│   ├── controllers/        # Обробники маршрутів
│   ├── models/             # Mongoose схеми
│   ├── services/           # Бізнес-логіка (движки Ризиків, Бюджету)
│   ├── middleware/         # Express middleware
│   ├── routes/             # API маршрути
│   └── package.json
├── docs/                   # Документація
│   ├── BUSINESS_LOGIC.md   # Движки Ризиків та Бюджету
│   ├── DATABASE_SCHEMA.md  # MongoDB схеми
│   └── USER_GUIDE.md       # Керівництво користувача
└── package.json            # Root package.json
```

---

## Документація

- **[Бізнес-логіка](./docs_ua/BUSINESS_LOGIC.md)** - Движок динамічних ризиків, Бюджетування S-кривою, Шлюз доступу
- **[Схема бази даних](./docs_ua/DATABASE_SCHEMA.md)** - MongoDB моделі та зв'язки
- **[Керівництво користувача](./docs_ua/USER_GUIDE.md)** - Онбординг, використання workspace, налаштування

---

## Ліцензія

Приватна - Всі права захищені

