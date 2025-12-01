# Документація схеми бази даних

Цей документ описує схему бази даних MongoDB для KBM Logic, включаючи всі моделі, їх поля, зв'язки та рішення щодо дизайну.

---

## Огляд

KBM Logic використовує MongoDB з Mongoose ODM. База даних складається з 4 основних колекцій:

1. **users** - Облікові записи користувачів (синхронізовано з Firebase Auth)
2. **projects** - Визначення проектів з вбудованими даними ролей
3. **tasks** - Елементи завдань з відстеженням часу та даними ризиків
4. **transactions** - Фінансові транзакції (доходи/витрати)

---

## Модель User

**Файл**: `server/models/User.js`  
**Колекція**: `users`

### Визначення схеми

```javascript
{
  uid: String,              // Firebase UID (унікальний, індексований)
  email: String,            // Обов'язкове, унікальне, нижній регістр
  displayName: String,      // Відображуване ім'я користувача
  avatar: String,           // URL аватара
  role: String,             // Enum: 'Pending' | 'User' | 'Admin'
  emailVerified: Boolean,   // Статус підтвердження email у Firebase
  phoneNumber: String,      // Необов'язковий номер телефону
  profile: {
    bio: String,
    location: String
  },
  createdProjects: [ObjectId],  // Масив ID проектів (ref: 'Project')
  projectsCount: Number,        // Кількість створених проектів
  createdAt: Date,
  updatedAt: Date
}
```

### Ключові функції

- **Первинний ключ**: `uid` (Firebase UID рядок, не MongoDB ObjectId)
- **Унікальні обмеження**: `uid`, `email`
- **Індекси**: `uid` (для швидкого пошуку Firebase)

### Зв'язки

- **Один-до-багатьох**: `createdProjects` → `Project.ownerId`
- **Багато-до-багатьох**: Посилається в `Project.members[].userId`

### Потік даних

- Дані користувача синхронізуються з Firebase Auth у MongoDB під час входу
- Оновлення профілю зберігаються в MongoDB
- Масив `createdProjects` оновлюється, коли користувач створює проект

---

## Модель Project

**Файл**: `server/models/Project.js`  
**Колекція**: `projects`

### Визначення схеми

```javascript
{
  name: String,                  // Обов'язкове, обрізане
  description: String,           // Необов'язковий опис проекту
  passwordHash: String,          // Bcrypt хешований (select: false)
  ownerId: ObjectId,             // Ref: 'User' (індексований)
  fixedCosts: [{
    title: String,               // Назва витрат
    amount: Number,              // Сума (мін: 0)
    frequency: String,           // Enum: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    currency: String             // За замовчуванням: 'USD'
  }],
  members: [{                    // Вбудовані документи членів
    userId: ObjectId,            // Ref: 'User' (обов'язкове)
    roleName: String,            // Enum: 'Owner' | 'Admin' | 'PM' | 'Developer' | 'Guest'
    permissions: [String],       // Масив рядків дозволів
    hourlyRate: Number,          // За замовчуванням: 0
    joinedAt: Date              // За замовчуванням: Date.now
  }],
  inviteCode: String,            // Унікальний, розріджений, автоматично генерований
  isDeleted: Boolean,            // Прапорець м'якого видалення (індексований)
  createdAt: Date,
  updatedAt: Date
}
```

### Ключове рішення дизайну: Вбудовані дані ролей

**Важливо**: Дані ролей зберігаються **вбудовано** в масиві `members`, а не в окремій колекції.

**Переваги**:
- Дані ролей завжди доступні під час запиту членів
- Не потрібні додаткові populate-запити
- Простіша перевірка дозволів
- Краща продуктивність

**Структура**:
Кожен документ члена містить:
- `roleName`: Ідентифікатор ролі
- `permissions`: Масив рядків дозволів, специфічних для цього члена
- `hourlyRate`: Годинна ставка члена для розрахунків витрат

### Ролі за замовчуванням

Модель Project має статичний метод `getDefaultRoles()`, який повертає:

1. **Owner**
   - Дозволи: ALL_PERMISSIONS
   - Ієрархія: 0

2. **Admin**
   - Дозволи: Перегляд всього, редагування всього (крім видалення проекту)
   - Ієрархія: 10

3. **PM** (Project Manager)
   - Дозволи: Перегляд всього, створення/редагування завдань, запрошення користувачів
   - Ієрархія: 20

4. **Developer**
   - Дозволи: Перегляд завдань/ризиків, відстеження часу, створення/редагування завдань
   - Ієрархія: 30

5. **Guest**
   - Дозволи: Немає (порожній масив)
   - Ієрархія: 100

### Доступні дозволи

```javascript
[
  'can_view_dashboard',
  'can_view_tasks',
  'can_view_risks',
  'can_view_financial',
  'can_track_time',
  'can_create_tasks',
  'can_edit_tasks',
  'can_delete_tasks',
  'can_edit_budget',
  'can_manage_roles',
  'can_invite_users',
  'can_manage_settings',
  'can_delete_project'
]
```

### Зв'язки

- **Багато-до-одного**: `ownerId` → `User._id`
- **Багато-до-багатьох**: `members[].userId` → `User._id`
- **Один-до-багатьох**: Посилається в `Task.projectId`
- **Один-до-багатьох**: Посилається в `Transaction.projectId`

### Індекси

- `{ ownerId: 1, isDeleted: 1 }` - Швидкі запити для проектів користувача
- `{ inviteCode: 1 }` - Швидкий пошук коду запрошення

### Автоматично генеровані поля

- `inviteCode`: Генерується перед збереженням, якщо не надано
- Формат: Випадковий буквено-цифровий рядок (30 символів)

---

## Модель Task

**Файл**: `server/models/Task.js`  
**Колекція**: `tasks`

### Визначення схеми

```javascript
{
  projectId: ObjectId,           // Ref: 'Project' (індексований)
  title: String,                 // Обов'язкове, обрізане
  description: String,           // Необов'язковий опис завдання
  status: String,                // Enum: 'Todo' | 'In Progress' | 'Review' | 'Done'
  priority: String,              // Enum: 'Low' | 'Medium' | 'High' | 'Critical'
  complexity: String,            // Enum: 'Low' | 'Med' | 'High'
  assignees: [ObjectId],         // Масив ID користувачів (ref: 'User')
  deadline: Date,                // Необов'язковий дедлайн завдання
  timeLogs: [{
    userId: ObjectId,            // Ref: 'User' (обов'язкове)
    startTime: Date,             // Обов'язкове
    endTime: Date,               // Необов'язкове (null, якщо таймер запущено)
    duration: Number,            // Тривалість у секундах
    description: String          // Необов'язковий опис запису
  }],
  risk: {
    probability: Number,         // 1-5 (мін: 1, макс: 5, за замовчуванням: 1)
    impact: Number,              // 1-5 (мін: 1, макс: 5, за замовчуванням: 1)
    auto_score: Number,          // Обчислено: probability × impact
    isAutoAdjusted: Boolean,     // True, якщо автоматично скориговано движком ризиків
    autoAdjustReason: String     // Причина автоматичної корекції
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Ключові функції

- **Логи часу**: Вбудовані піддокументи для відстеження часу
- **Дані ризику**: Вбудований об'єкт (не окрема колекція)
- **Робочий процес статусу**: Todo → In Progress → Review → Done

### Зв'язки

- **Багато-до-одного**: `projectId` → `Project._id`
- **Багато-до-багатьох**: `assignees[]` → `User._id`

### Індекси

- `{ projectId: 1, status: 1 }` - Швидкі запити за проектом та статусом
- `{ assignees: 1 }` - Швидкі запити для призначених завдань користувача
- `{ deadline: 1 }` - Швидкі запити дедлайнів (для розрахунків ризиків)

### Розрахунок оцінки ризику

`risk.auto_score` обчислюється як:
```
auto_score = probability × impact
```

Діапазон: 1-25 (1×1 = 1, 5×5 = 25)

Движок ризиків автоматично коригує `probability` та перераховує `auto_score` на основі:
- Наближення дедлайну (якщо < 2 дні, probability +1)
- Статусу бюджету (майбутнє: якщо перевитрата, probability +1)

### Структура логу часу

Кожен запис логу часу представляє робочу сесію:
- `startTime`: Коли запущено таймер
- `endTime`: Коли зупинено таймер (null, якщо все ще працює)
- `duration`: Обчислена тривалість у секундах
- Лише один активний таймер на завдання (немає перекриваючих логів часу)

---

## Модель Transaction

**Файл**: `server/models/Transaction.js`  
**Колекція**: `transactions`

### Визначення схеми

```javascript
{
  projectId: ObjectId,           // Ref: 'Project' (індексований)
  amount: Number,                // Обов'язкова сума транзакції
  type: String,                  // Enum: '+' | '-'
  source: String,                // Обов'язкове, обрізане (джерело транзакції)
  date: Date,                    // Обов'язкове, незмінне, індексоване
  authorId: ObjectId,            // Ref: 'User' (обов'язкове)
  description: String,           // Необов'язковий опис транзакції
  createdAt: Date,
  updatedAt: Date
}
```

### Ключові функції

- **Незмінна дата**: Поле `date` не може бути змінено після створення
- **Тип**: '+' для доходів, '-' для витрат
- **Джерело**: Опис звідки/куди йшла транзакція

### Зв'язки

- **Багато-до-одного**: `projectId` → `Project._id`
- **Багато-до-одного**: `authorId` → `User._id`

### Індекси

- `{ projectId: 1, date: -1 }` - Швидкі запити для транзакцій проекту (найновіші спочатку)
- `{ projectId: 1, type: 1 }` - Швидкі запити за проектом та типом

### Використання в розрахунках бюджету

Транзакції включаються в розрахунок Фактичної вартості (AC):
- Позитивні транзакції (`type: '+'`) додаються до суми
- Негативні транзакції (`type: '-'`) віднімаються від суми

---

## Модель Activity (Майбутнє)

**Статус**: Заплановано, але ще не реалізовано

Модель Activity відстежуватиме події проекту для Стрічки активності:

```javascript
{
  projectId: ObjectId,           // Ref: 'Project'
  userId: ObjectId,              // Ref: 'User' (хто виконав дію)
  action: String,                // Enum: 'task_created' | 'task_updated' | 'member_added' | тощо
  entityType: String,            // 'task' | 'transaction' | 'member' | 'project'
  entityId: ObjectId,            // ID зачіпленої сутності
  metadata: Object,              // Додатковий контекст (назва завдання, ім'я члена тощо)
  createdAt: Date                // Коли відбулася активність
}
```

**Заплановані дії**:
- Створення/оновлення/завершення завдання
- Додавання/видалення/зміна ролі члена
- Додавання транзакції
- Оновлення налаштувань проекту

---

## Діаграма зв'язків даних

```
User (uid)
  │
  ├─→ createdProjects[] ───→ Project
  │                            │
  │                            ├─→ ownerId ───→ User
  │                            │
  │                            └─→ members[]
  │                                 │
  │                                 └─→ userId ───→ User
  │
  ├─→ Посилається в Project.members[]
  ├─→ Посилається в Task.assignees[]
  └─→ Посилається в Task.timeLogs[].userId

Project
  │
  ├─→ Посилається в Task.projectId
  └─→ Посилається в Transaction.projectId

Task
  │
  └─→ projectId ───→ Project
  └─→ assignees[] ───→ User
  └─→ timeLogs[].userId ───→ User

Transaction
  │
  ├─→ projectId ───→ Project
  └─→ authorId ───→ User
```

---

## Патерни дизайну

### 1. Вбудовані vs Посилання

**Вбудовані** (зберігаються безпосередньо в документі):
- `Project.members[]` - Дані ролей зберігаються вбудовано
- `Task.risk` - Дані ризику зберігаються вбудовано
- `Task.timeLogs[]` - Записи часу зберігаються вбудовано
- `Project.fixedCosts[]` - Фіксовані витрати зберігаються вбудовано

**Посилання** (зберігаються як ObjectId):
- `Project.ownerId` → User
- `Task.assignees[]` → User
- `Task.projectId` → Project
- `Transaction.projectId` → Project

### 2. М'яке видалення

- Проекти використовують прапорець `isDeleted: Boolean`
- Дозволяє відновлення та аудит
- Запити за замовчуванням фільтрують видалені проекти

### 3. Незмінні поля

- `Transaction.date` - Не може бути змінено після створення
- Забезпечує цілісність фінансового аудиту

### 4. Автоматично генеровані поля

- `Project.inviteCode` - Генерується перед збереженням
- Забезпечує унікальні коди запрошення для всіх проектів

---

## Стратегія індексування

### Запити з високим навантаженням

1. **Проекти користувача**
   - Індекс: `{ ownerId: 1, isDeleted: 1 }`
   - Використовується в: `GET /api/projects`

2. **Завдання проекту за статусом**
   - Індекс: `{ projectId: 1, status: 1 }`
   - Використовується в: Фільтрації Kanban-дошки

3. **Призначені завдання користувача**
   - Індекс: `{ assignees: 1 }`
   - Використовується в: Фільтрі "Мої завдання"

4. **Транзакції проекту**
   - Індекс: `{ projectId: 1, date: -1 }`
   - Використовується в: Історії транзакцій

### Продуктивність пошуку

- Пошук користувачів за Firebase UID: індекс `uid`
- Пошук проекту за кодом запрошення: індекс `inviteCode`
- Розрахунки ризиків на основі дедлайнів: індекс `deadline`

---

## Підсумок

Схема бази даних розроблена для:

1. **Продуктивність** - Вбудовані дані ролей, стратегічні індекси
2. **Гнучкість** - Вбудовані дозволи, розширювані дані ризиків
3. **Цілісність даних** - Референційна цілісність, незмінні поля
4. **Аудит-трейл** - М'яке видалення, часові мітки на всіх документах

Всі зв'язки підтримуються через посилання MongoDB ObjectId, з Mongoose, що обробляє populate при необхідності.

