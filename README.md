# KBM Logic v3.0

**Hybrid Project Management System with Enterprise Financial Control**

---

## 🇬🇧 English | [🇺🇦 Українська](#-українська)

### Overview

**KBM Logic v3.0** is a comprehensive project management platform that combines agile Kanban workflows with sophisticated Earned Value Management (EVM) financial tracking. Built on the MERN stack, it provides teams with both flexible task management and enterprise-grade budget control.

### Key Features

- **Kanban Task Management** - Visual drag-and-drop boards with 4-column workflow
- **Earned Value Management** - Automated PV, AC, EV calculations with schedule-aware accrual
- **Role-Based Access Control** - Hierarchical roles with granular permissions
- **Financial Dashboard** - Real-time budget tracking with S-Curve visualization
- **Time Tracking** - Built-in start/stop timer for tasks
- **Risk Management** - Auto-calculated risk scores based on deadlines and budget
- **Investor Reports** - PDF reports with time range filtering

### Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend:** Node.js, Express.js, MongoDB Atlas, Mongoose
- **Authentication:** Firebase Auth
- **Database:** MongoDB Atlas (cloud-hosted)

### Quick Start

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd kbm-logic-v0.1
   ```

2. **Install Dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure Environment**
   - Create `server/.env` with MongoDB Atlas URI and Firebase credentials
   - Create `client/.env` with Firebase configuration
   - Place `firebase-service-account.json` in `server/` directory

4. **Run Development Servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### Documentation

#### English Documentation (`docs/`)

1. **[Architecture and Setup](./docs/01-architecture-and-setup.md)**
   - Tech stack overview
   - MongoDB Atlas connection
   - Environment configuration
   - Development workflow

2. **[Financial Engine](./docs/02-financial-engine.md)** ⭐ CRITICAL
   - PV (Planned Value) - Automated calculation
   - AC (Actual Cost) - Schedule-aware accrual
   - EV (Earned Value) - Completed work value
   - Dual timestamping (createdAt vs effectiveDate)
   - Time Machine (Snapshot Regenerator)

3. **[Roles and Permissions](./docs/03-roles-and-permissions.md)**
   - RBAC system overview
   - Permission list and hierarchy rules
   - Role-based compensation model
   - Salary history tracking

4. **[Tasks and Workflow](./docs/04-tasks-and-workflow.md)**
   - Kanban board structure
   - Task duration calculation (work schedule aware)
   - Time tracking functionality
   - Task lifecycle

5. **[Database Schema](./docs/05-database-schema.md)**
   - Project, Task, Transaction models
   - User, Expense, Snapshot schemas
   - Relationships and indexes
   - Data integrity rules

---

## 🇺🇦 Українська

### Огляд

**KBM Logic v3.0** - це комплексна платформа управління проектами, яка поєднує гнучкі робочі процеси Kanban з складним фінансовим відстеженням Управління Заробленою Вартістю (EVM). Побудована на стеку MERN, вона надає командам як гнучке управління задачами, так і корпоративний контроль бюджету.

### Ключові Можливості

- **Управління Задачами Kanban** - Візуальні дошки з drag-and-drop та 4-колоночним робочим процесом
- **Управління Заробленою Вартістю** - Автоматизовані розрахунки PV, AC, EV з нарахуванням з урахуванням розкладу
- **Контроль Доступу на Основі Ролей** - Ієрархічні ролі з детальними дозволами
- **Фінансова Панель** - Відстеження бюджету в реальному часі з візуалізацією S-Кривої
- **Відстеження Часу** - Вбудований таймер старт/стоп для задач
- **Управління Ризиками** - Автоматично розраховані оцінки ризиків на основі дедлайнів та бюджету
- **Звіти для Інвесторів** - PDF звіти з фільтрацією за часовим діапазоном

### Технологічний Стек

- **Фронтенд:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Бекенд:** Node.js, Express.js, MongoDB Atlas, Mongoose
- **Аутентифікація:** Firebase Auth
- **База Даних:** MongoDB Atlas (хмарна)

### Швидкий Старт

1. **Клонувати Репозиторій**
   ```bash
   git clone <repository-url>
   cd kbm-logic-v0.1
   ```

2. **Встановити Залежності**
   ```bash
   npm run install:all
   ```

3. **Налаштувати Середовище**
   - Створіть `server/.env` з URI MongoDB Atlas та обліковими даними Firebase
   - Створіть `client/.env` з конфігурацією Firebase
   - Помістіть `firebase-service-account.json` в директорію `server/`

4. **Запустити Сервери Розробки**
   ```bash
   npm run dev
   ```

   - Фронтенд: http://localhost:5173
   - Backend API: http://localhost:5000

### Документація

#### Українська Документація (`docs_ukr/`)

1. **[Архітектура та Налаштування](./docs_ukr/01-architecture-and-setup.md)**
   - Огляд технологічного стеку
   - Підключення до MongoDB Atlas
   - Конфігурація середовища
   - Робочий процес розробки

2. **[Фінансовий Движок](./docs_ukr/02-financial-engine.md)** ⭐ КРИТИЧНО
   - PV (Запланована Вартість) - Автоматизований розрахунок
   - AC (Фактична Вартість) - Нарахування з урахуванням розкладу
   - EV (Зароблена Вартість) - Вартість виконаної роботи
   - Подвійне відмічання часу (createdAt vs effectiveDate)
   - Машина Часу (Регенератор Снапшотів)

3. **[Ролі та Дозволи](./docs_ukr/03-roles-and-permissions.md)**
   - Огляд системи RBAC
   - Список дозволів та правила ієрархії
   - Модель компенсації на основі ролей
   - Відстеження історії зарплат

4. **[Задачі та Робочий Процес](./docs_ukr/04-tasks-and-workflow.md)**
   - Структура Kanban дошки
   - Розрахунок тривалості задачі (з урахуванням робочого розкладу)
   - Функціональність відстеження часу
   - Життєвий цикл задачі

5. **[Схема Бази Даних](./docs_ukr/05-database-schema.md)**
   - Моделі Project, Task, Transaction
   - Схеми User, Expense, Snapshot
   - Зв'язки та індекси
   - Правила цілісності даних

---

## Project Structure

```
kbm-logic-v0.1/
├── client/          # React frontend
├── server/          # Node.js backend
├── docs/            # English documentation
├── docs_ukr/        # Ukrainian documentation
└── README.md        # This file
```

## License

Private - All rights reserved

---

**Version:** 3.0  
**Last Updated:** 2024
