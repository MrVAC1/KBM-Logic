# KBM Logic - Система Управління Проектами

## 🇺🇦 Українська Версія

### Огляд

**KBM Logic** - це гібридна система управління проектами, яка поєднує простоту Kanban з корпоративним фінансовим контролем. Система призначена для команд, яким потрібне як гнучке управління задачами (Kanban дошки), так і складне фінансове відстеження (S-Криві бюджетування, Управління Заробленою Вартістю).

### Ключові Можливості

- **Kanban Управління Задачами** - Візуальні дошки задач з drag-and-drop робочим процесом
- **Динамічний Движок Ризиків** - Автоматична корекція оцінок ризиків на основі дедлайнів та бюджету
- **S-Криве Бюджетування** - Криві Запланованої Вартості з відстеженням фактичних витрат
- **Фінансова Панель** - Комплексне фінансове відстеження з EVM (Earned Value Management)
- **Контроль Доступу на Основі Ролей** - Детальні дозволи для кожного члена проекту
- **Звіти для Інвесторів** - PDF звіти з фільтром часового діапазону
- **Управління Дедлайнами** - RBAC-захищене редагування цільових дат завершення

### Технологічний Стек

#### Frontend
- **React 18** - UI бібліотека
- **TypeScript** - Типобезпека
- **Vite** - Інструмент збірки
- **Tailwind CSS** - Стилізація
- **Recharts** - Візуалізація даних (бюджетні криві, графіки)
- **Firebase Auth** - Аутентифікація
- **React Router** - Навігація
- **Shadcn UI** - Бібліотека компонентів

#### Backend
- **Node.js** - Середовище виконання
- **Express** - Web фреймворк
- **MongoDB Atlas** - Хмарна база даних
- **Mongoose** - ODM
- **Firebase Admin** - Перевірка токенів
- **bcryptjs** - Хешування паролів

### Швидкий Старт

#### Вимоги

- Node.js 18+
- MongoDB Atlas (хмарний екземпляр)
- Firebase проект (для аутентифікації)

#### Встановлення

1. **Встановити всі залежності** (root, server, та client):
```bash
npm run install:all
```

2. **Налаштувати змінні середовища**:

Створити `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
CORS_ORIGIN=http://localhost:5173
```

Створити `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Запуск Серверів Розробки

**Варіант 1: Запустити обидва сервери разом**
```bash
npm run dev
```

**Варіант 2: Запустити окремо**

Термінал 1 - Server:
```bash
cd server
npm run dev
```

Термінал 2 - Client:
```bash
cd client
npm run dev
```

Додаток буде доступний на:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

### Структура Проекту

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
│   ├── controllers/       # Обробники маршрутів
│   ├── models/            # Mongoose схеми
│   ├── services/          # Бізнес-логіка (EVM, Budget engines)
│   ├── middleware/        # Express middleware
│   ├── routes/            # API маршрути
│   ├── scripts/           # Скрипти міграції
│   └── package.json
├── docs/                  # Документація (English)
│   ├── EVM_FINANCIAL_LOGIC.md
│   ├── MODULES.md
│   └── DATABASE.md
├── docs_ukr/              # Документація (Українська)
│   ├── EVM_FINANCIAL_LOGIC.md
│   ├── MODULES.md
│   └── DATABASE.md
└── package.json           # Root package.json
```

### Документація

#### Англійська Версія (`docs/`)
- **[EVM Financial Logic](./docs/EVM_FINANCIAL_LOGIC.md)** - Формули PV, AC, EV, адаптивна гранулярність
- **[Modules](./docs/MODULES.md)** - Опис модулів: Project Info, Kanban, Financial Dashboard, Investor Report
- **[Database](./docs/DATABASE.md)** - MongoDB Atlas інтеграція, моделі, індекси

#### Українська Версія (`docs_ukr/`)
- **[EVM Фінансова Логіка](./docs_ukr/EVM_FINANCIAL_LOGIC.md)** - Формули PV, AC, EV, адаптивна гранулярність
- **[Модулі](./docs_ukr/MODULES.md)** - Опис модулів: Інформація про Проект, Kanban, Фінансова Панель, Звіт для Інвесторів
- **[База Даних](./docs_ukr/DATABASE.md)** - Інтеграція MongoDB Atlas, моделі, індекси

### Основні Можливості Системи

#### Фінансова Система (EVM)

**Запланована Вартість (PV):**
- Розраховується з задач та їх оцінок годин
- Використовує місячні зарплати для розрахунку ставок
- Враховує робочий графік проекту

**Фактична Вартість (AC):**
- **Джерело 1:** Зарплати (розраховані денні ставки)
- **Джерело 2:** Фіксовані витрати (з частотою)
- **Джерело 3:** Негативні транзакції (`type: '-'`)

**Зароблена Вартість (EV):**
- Розраховується з завершених задач (`status: 'Done'`)
- Використовує бюджети задач на момент завершення

**Бюджет:**
- **Загальний Доступний Бюджет = PV (Базовий) + Позитивні Транзакції (Доходи)**
- **Залишковий Бюджет = (PV + Доходи) - AC**

#### Адаптивна Гранулярність

Система використовує 5-рівневу систему для оптимізації щільності графіка (ціль: 30-60 точок):

- < 60 днів: Щоденна вибірка
- < 180 днів: Щотижнева вибірка
- < 2 роки: Двотyzжнева вибірка
- < 5 років: Щомісячна вибірка
- ≥ 5 років: Квартальна вибірка

#### Управління Дедлайнами

- **Поле:** `Project.deadline` (Date, nullable)
- **RBAC:** Вимагає дозвіл `can_manage_deadline`
- **Валідація:** Дедлайн повинен бути строго після `project.createdAt`
- **UI:** Редагування доступне тільки користувачам з дозволом

#### Звіти для Інвесторів

- **Фільтр Часового Діапазону:** 'all' | 'month' | 'year'
- **PDF Експорт:** Генерація PDF звітів
- **Метрики:** Burn Rate, Runway, Financials, Top Risks, Roadmap Status
- **Команда:** Дані про команду (тільки для Власника)

### Скрипти Міграції

```bash
# Очистити застарілі дозволи
cd server
npm run cleanup:permissions

# Виправити дозволи дедлайну
npm run fix:deadline-permissions
```

### Ліцензія

Приватна - Всі права захищені

---

## 🇬🇧 English Version

### Overview

**KBM Logic** is a hybrid project management system combining Kanban simplicity with enterprise financial control. The system is designed for teams that need both agile task management (Kanban boards) and sophisticated financial tracking (S-Curve budgeting, Earned Value Management).

### Key Features

- **Kanban Task Management** - Visual task boards with drag-and-drop workflow
- **Dynamic Risk Engine** - Auto-adjusting risk scores based on deadlines and budget
- **S-Curve Budgeting** - Planned Value curves with actual cost tracking
- **Financial Dashboard** - Comprehensive financial tracking with EVM (Earned Value Management)
- **Role-Based Access Control** - Granular permissions per project member
- **Investor Reports** - PDF reports with time range filter
- **Deadline Management** - RBAC-protected editing of target completion dates

### Tech Stack

#### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization (budget curves, charts)
- **Firebase Auth** - Authentication
- **React Router** - Navigation
- **Shadcn UI** - Component library

#### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB Atlas** - Cloud database
- **Mongoose** - ODM
- **Firebase Admin** - Token verification
- **bcryptjs** - Password hashing

### Quick Start

#### Prerequisites

- Node.js 18+
- MongoDB Atlas (cloud instance)
- Firebase project (for authentication)

#### Installation

1. **Install all dependencies** (root, server, and client):
```bash
npm run install:all
```

2. **Set up environment variables**:

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxx.mongodb.net/kbm-logic?retryWrites=true&w=majority&appName=Cluster0
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
CORS_ORIGIN=http://localhost:5173
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Run Development Servers

**Option 1: Run both server and client together**
```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Server:
```bash
cd server
npm run dev
```

Terminal 2 - Client:
```bash
cd client
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

### Project Structure

```
kbm-logic-v0.1/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── contexts/        # React contexts
│   │   ├── services/       # API services
│   │   └── lib/            # Utilities
│   └── package.json
├── server/                 # Node.js backend
│   ├── controllers/       # Route handlers
│   ├── models/            # Mongoose schemas
│   ├── services/          # Business logic (EVM, Budget engines)
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── scripts/           # Migration scripts
│   └── package.json
├── docs/                  # Documentation (English)
│   ├── EVM_FINANCIAL_LOGIC.md
│   ├── MODULES.md
│   └── DATABASE.md
├── docs_ukr/              # Documentation (Ukrainian)
│   ├── EVM_FINANCIAL_LOGIC.md
│   ├── MODULES.md
│   └── DATABASE.md
└── package.json           # Root package.json
```

### Documentation

#### English Version (`docs/`)
- **[EVM Financial Logic](./docs/EVM_FINANCIAL_LOGIC.md)** - PV, AC, EV formulas, adaptive granularity
- **[Modules](./docs/MODULES.md)** - Module descriptions: Project Info, Kanban, Financial Dashboard, Investor Report
- **[Database](./docs/DATABASE.md)** - MongoDB Atlas integration, models, indexes

#### Ukrainian Version (`docs_ukr/`)
- **[EVM Фінансова Логіка](./docs_ukr/EVM_FINANCIAL_LOGIC.md)** - Формули PV, AC, EV, адаптивна гранулярність
- **[Модулі](./docs_ukr/MODULES.md)** - Опис модулів: Інформація про Проект, Kanban, Фінансова Панель, Звіт для Інвесторів
- **[База Даних](./docs_ukr/DATABASE.md)** - Інтеграція MongoDB Atlas, моделі, індекси

### Core System Features

#### Financial System (EVM)

**Planned Value (PV):**
- Calculated from tasks and their hour estimates
- Uses monthly salaries to calculate rates
- Accounts for project work schedule

**Actual Cost (AC):**
- **Source 1:** Salaries (calculated daily rates)
- **Source 2:** Fixed Costs (with frequency)
- **Source 3:** Negative Transactions (`type: '-'`)

**Earned Value (EV):**
- Calculated from completed tasks (`status: 'Done'`)
- Uses task budgets at completion time

**Budget:**
- **Total Available Budget = PV (Baseline) + Positive Transactions (Income)**
- **Remaining Budget = (PV + Income) - AC**

#### Adaptive Granularity

The system uses a 5-tier system to optimize chart density (target: 30-60 points):

- < 60 days: Daily sampling
- < 180 days: Weekly sampling
- < 2 years: Bi-weekly sampling
- < 5 years: Monthly sampling
- ≥ 5 years: Quarterly sampling

#### Deadline Management

- **Field:** `Project.deadline` (Date, nullable)
- **RBAC:** Requires `can_manage_deadline` permission
- **Validation:** Deadline must be strictly after `project.createdAt`
- **UI:** Editing available only to users with permission

#### Investor Reports

- **Time Range Filter:** 'all' | 'month' | 'year'
- **PDF Export:** PDF report generation
- **Metrics:** Burn Rate, Runway, Financials, Top Risks, Roadmap Status
- **Team:** Team data (Owner only)

### Migration Scripts

```bash
# Cleanup obsolete permissions
cd server
npm run cleanup:permissions

# Fix deadline permissions
npm run fix:deadline-permissions
```

### License

Private - All rights reserved
