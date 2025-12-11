# Проєктування Бази Даних: ER-Діаграма та Mongoose-Схеми

## Огляд

Цей документ містить детальну ER-діаграму та повні Mongoose-схеми для колекцій **Project** (з параметрами робочого розкладу) та **Task** (з полями для фінансових оцінок) системи KBM Logic v3.1.

---

## ER-Діаграма

### Сутності та Зв'язки

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROJECT                                 │
├─────────────────────────────────────────────────────────────────┤
│ _id: ObjectId (PK)                                              │
│ name: String (required)                                         │
│ description: String                                             │
│ passwordHash: String (required, select: false)                  │
│ ownerId: ObjectId (FK → User._id, indexed)                     │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ workSchedule (ОБОВ'ЯЗКОВЕ для фінансових розрахунків)    │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ workingDays: [Number] (default: [1,2,3,4,5])            │  │
│ │   - Масив номерів днів тижня (0=Неділя, 6=Субота)        │  │
│ │   - Валідація: кожен елемент 0-6                         │  │
│ │ hoursPerDay: Number (min: 1, max: 24, default: 8)       │  │
│ │   - Години роботи на день                                 │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ fixedCosts: [FixedCost]                                         │
│   - title: String (required)                                    │
│   - amount: Number (required, min: 0)                           │
│   - frequency: Enum (one-time|daily|weekly|monthly|yearly)      │
│   - currency: String (default: 'USD')                          │
│                                                                 │
│ roles: [RoleCompensation]                                       │
│   - name: String (required)                                     │
│   - currentRate: Number (default: 0, min: 0)                   │
│   - salaryHistory: [SalaryHistory]                              │
│     - rate: Number (required, min: 0)                           │
│     - effectiveDate: Date (required)                            │
│                                                                 │
│ members: [Member]                                                │
│   - userId: ObjectId (FK → User._id, required)                │
│   - roles: [String] (required)                                  │
│   - roleName: String (required, default: 'Guest')              │
│   - permissions: [String] (enum: ALL_PERMISSIONS)              │
│   - hourlyRate: Number (default: 0)                             │
│   - joinedAt: Date (default: Date.now)                         │
│   - notificationSettings: Object                                │
│                                                                 │
│ evmSnapshots: [EVMSnapshot]                                     │
│   - date: Date (required, indexed)                             │
│   - plannedValue: Number (default: 0, min: 0)                  │
│   - actualCost: Number (default: 0, min: 0)                    │
│   - earnedValue: Number (default: 0, min: 0)                    │
│                                                                 │
│ deadline: Date (nullable)                                       │
│ cumulativeActualCost: Number (default: 0, min: 0)               │
│ workingHoursPerMonth: Number (default: 160, min: 1)            │
│ createdAt: Date (auto)                                          │
│ updatedAt: Date (auto)                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           TASK                                   │
├─────────────────────────────────────────────────────────────────┤
│ _id: ObjectId (PK)                                              │
│ projectId: ObjectId (FK → Project._id, required, indexed)      │
│ title: String (required)                                        │
│ description: String                                             │
│ status: Enum (Todo|In Progress|Review|Done, default: 'Todo')   │
│ priority: Enum (Low|Medium|High|Critical, default: 'Medium')    │
│ complexity: Enum (Low|Med|High, default: 'Med')                 │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Фінансові Оцінки (ОБОВ'ЯЗКОВІ для EVM розрахунків)       │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ estimateHours: Number (required, min: 0)                  │  │
│ │   - Оцінка годин для виконання задачі (EFFORT)            │  │
│ │   - Використовується для розрахунку PV та EV              │  │
│ │                                                           │  │
│ │ plannedValue: Number (default: 0, min: 0)                 │  │
│ │   - Запланована вартість (PV) задачі                      │  │
│ │   - Розраховується: estimateHours × avgHourlyRate         │  │
│ │   - Автоматично оновлюється при зміні ставок/оцінок       │  │
│ │                                                           │  │
│ │ plannedCost: Number (default: 0, min: 0)                  │  │
│ │   - Запланована вартість (дублікат plannedValue)          │  │
│ │   - Зберігається для зворотної сумісності                  │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ assignees: [ObjectId] (FK → User._id)                          │
│   - Масив виконавців задачі                                     │
│   - Використовується для розрахунку avgHourlyRate              │
│                                                                 │
│ startDate: Date (nullable)                                      │
│   - Дата початку задачі                                         │
│   - Використовується для розподілу PV по часу                  │
│                                                                 │
│ deadline: Date (nullable, indexed)                              │
│   - Дедлайн задачі                                              │
│   - Використовується для розподілу PV по часу                  │
│                                                                 │
│ timeLogs: [TimeLog]                                              │
│   - userId: ObjectId (FK → User._id, required)                 │
│   - startTime: Date (required)                                  │
│   - endTime: Date (nullable)                                    │
│   - duration: Number (default: 0, в секундах)                  │
│   - description: String                                          │
│                                                                 │
│ risk: Risk                                                       │
│   - probability: Number (min: 1, max: 5, default: 1)           │
│   - impact: Number (min: 1, max: 5, default: 1)                │
│   - auto_score: Number (default: 1)                            │
│   - isAutoAdjusted: Boolean (default: false)                    │
│   - autoAdjustReason: String                                    │
│                                                                 │
│ createdAt: Date (auto)                                          │
│ updatedAt: Date (auto)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Зв'язки

1. **Project → Task** (1:N)
   - Один проект має багато задач
   - Зв'язок: `Task.projectId → Project._id`
   - Каскадне видалення: при видаленні проекту видаляються всі задачі

2. **Project → User** (N:1 через ownerId)
   - Багато проектів належать одному власнику
   - Зв'язок: `Project.ownerId → User._id`

3. **Project → User** (N:M через members)
   - Багато проектів мають багато членів
   - Зв'язок: `Project.members[].userId → User._id`

4. **Task → User** (N:M через assignees)
   - Багато задач мають багато виконавців
   - Зв'язок: `Task.assignees[] → User._id`

---

## Mongoose-Схеми

### Project Schema

```javascript
import mongoose from 'mongoose';

// Вкладені схеми
const fixedCostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  frequency: {
    type: String,
    enum: ['one-time', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly',
  },
  currency: {
    type: String,
    default: 'USD',
  },
}, { _id: true });

const salaryHistorySchema = new mongoose.Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  effectiveDate: {
    type: Date,
    required: true,
  },
}, { _id: false });

const roleCompSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  currentRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  salaryHistory: {
    type: [salaryHistorySchema],
    default: [],
  },
}, { _id: true });

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  roles: [{
    type: String,
    required: true,
  }],
  roleName: {
    type: String,
    required: true,
    default: 'Guest',
  },
  permissions: [{
    type: String,
    enum: ALL_PERMISSIONS,
  }],
  hourlyRate: {
    type: Number,
    default: 0,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  notificationSettings: {
    notifyOnTaskAssignment: {
      type: Boolean,
      default: true,
    },
    notifyOnBudgetRisk: {
      type: Boolean,
      default: true,
    },
    notifyOnRoleChange: {
      type: Boolean,
      default: true,
    },
    notifyOnTaskOverdue: {
      type: Boolean,
      default: true,
    },
    notifyOnTaskCompleted: {
      type: Boolean,
      default: true,
    },
  },
}, { _id: true });

const evmSnapshotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true,
  },
  plannedValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  actualCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  earnedValue: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { _id: false });

// Основна схема Project
const projectSchema = new mongoose.Schema({
  // Базова інформація
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Фінансова конфігурація
  fixedCosts: [fixedCostSchema],
  roles: [roleCompSchema],

  // Користувацькі ролі
  customRoles: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      default: '#6b7280',
    },
    hierarchy: {
      type: Number,
      default: 200,
    },
    permissions: [{
      type: String,
      enum: ALL_PERMISSIONS,
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Члени команди
  members: [memberSchema],

  // ═══════════════════════════════════════════════════════════
  // РОБОЧИЙ РОЗКЛАД (Work Schedule)
  // ═══════════════════════════════════════════════════════════
  // КРИТИЧНО: Це поле обов'язкове для фінансових розрахунків
  // Використовується EVM движком для:
  // - Розрахунку робочих днів (countWorkingDaysInclusive)
  // - Конвертації місячних ставок в годинні (monthlyRate → hourlyRate)
  // - Розподілу PV по часу (timeline distribution)
  // ═══════════════════════════════════════════════════════════
  workSchedule: {
    workingDays: {
      type: [Number], // JavaScript getDay() формат: 0=Неділя, 6=Субота
      default: [1, 2, 3, 4, 5], // За замовчуванням: Понеділок-П'ятниця
      validate: {
        validator: (days) => {
          return Array.isArray(days) && 
                 days.length > 0 && 
                 days.every(d => d >= 0 && d <= 6);
        },
        message: 'workingDays must be a non-empty array of integers between 0 (Sun) and 6 (Sat)',
      },
    },
    hoursPerDay: {
      type: Number,
      min: 1,
      max: 24,
      default: 8, // За замовчуванням: 8 годин на день
      validate: {
        validator: (hours) => hours > 0 && hours <= 24,
        message: 'hoursPerDay must be between 1 and 24',
      },
    },
  },

  // Департаменти
  departments: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    memberIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Заблоковані користувачі
  bannedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    bannedAt: {
      type: Date,
      default: Date.now,
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  }],

  // Інвайт-код
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },

  // Дедлайн проекту
  deadline: {
    type: Date,
    default: null,
  },

  // М'яке видалення
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },

  // ═══════════════════════════════════════════════════════════
  // EVM Snapshots (Кешовані розрахунки)
  // ═══════════════════════════════════════════════════════════
  // Генеруються щодня через cron job (dailyEVMJob.js)
  // Регенеруються при створенні ретроактивних транзакцій
  // Використовуються для S-Curve графіків
  // ═══════════════════════════════════════════════════════════
  evmSnapshots: [evmSnapshotSchema],

  // Кумулятивна фактична вартість (для швидкого доступу)
  cumulativeActualCost: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Робочі години на місяць (за замовчуванням: 160 = 20 днів × 8 годин)
  workingHoursPerMonth: {
    type: Number,
    default: 160,
    min: 1,
  },
}, {
  timestamps: true, // Автоматично додає createdAt та updatedAt
});

// Індекси для оптимізації запитів
projectSchema.index({ ownerId: 1, isDeleted: 1 });
projectSchema.index({ inviteCode: 1 });

// Pre-save hook для генерації inviteCode
projectSchema.pre('save', async function(next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
  }
  next();
});

// Pre-save hook для синхронізації roles та roleName в members
memberSchema.pre('save', function(next) {
  // Якщо roles має елементи, встановлюємо roleName для зворотної сумісності
  if (this.roles && this.roles.length > 0 && !this.roleName) {
    this.roleName = this.roles[0];
  }
  // Якщо roles порожній, але roleName існує, мігруємо в roles
  if ((!this.roles || this.roles.length === 0) && this.roleName) {
    this.roles = [this.roleName];
  }
  // За замовчуванням Guest, якщо немає ролей
  if (!this.roles || this.roles.length === 0) {
    this.roles = ['Guest'];
    this.roleName = 'Guest';
  }
  next();
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
```

### Task Schema

```javascript
import mongoose from 'mongoose';

// Вкладені схеми
const timeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number, // в секундах
    default: 0,
  },
  description: String,
}, { timestamps: true });

const riskSchema = new mongoose.Schema({
  probability: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  },
  impact: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  },
  auto_score: {
    type: Number,
    default: 1,
  },
  isAutoAdjusted: {
    type: Boolean,
    default: false,
  },
  autoAdjustReason: String,
}, { _id: false });

// Основна схема Task
const taskSchema = new mongoose.Schema({
  // Зв'язок з проектом
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },

  // Базова інформація
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },

  // Статус та пріоритет
  status: {
    type: String,
    enum: ['Todo', 'In Progress', 'Review', 'Done'],
    default: 'Todo',
    index: true,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
  },
  complexity: {
    type: String,
    enum: ['Low', 'Med', 'High'],
    default: 'Med',
  },

  // Виконавці
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Дати
  startDate: {
    type: Date,
  },
  deadline: {
    type: Date,
    index: true,
  },

  // ═══════════════════════════════════════════════════════════
  // ФІНАНСОВІ ОЦІНКИ (Financial Estimates)
  // ═══════════════════════════════════════════════════════════
  // КРИТИЧНО: Ці поля обов'язкові для EVM розрахунків
  // Використовуються для обчислення:
  // - Planned Value (PV) = estimateHours × avgHourlyRate
  // - Earned Value (EV) = PV завершених задач (status = 'Done')
  // - Budget at Completion (BAC) = Σ(PV всіх задач)
  // ═══════════════════════════════════════════════════════════

  // Оцінка годин для виконання задачі (EFFORT, не тривалість!)
  // Це основне поле для фінансових розрахунків
  estimateHours: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: (hours) => hours >= 0,
      message: 'estimateHours must be a non-negative number',
    },
  },

  // Запланована вартість (Planned Value) задачі
  // Розраховується автоматично: estimateHours × avgHourlyRate
  // Де avgHourlyRate = середнє арифметичне годинних ставок всіх виконавців
  // Оновлюється при зміні:
  // - estimateHours
  // - assignees (зміна виконавців)
  // - ставок ролей (currentRate або salaryHistory)
  plannedValue: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (value) => value >= 0,
      message: 'plannedValue must be a non-negative number',
    },
  },

  // Запланована вартість (дублікат plannedValue для зворотної сумісності)
  // Зберігає те саме значення, що plannedValue
  // Може бути видалено в майбутніх версіях
  plannedCost: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (value) => value >= 0,
      message: 'plannedCost must be a non-negative number',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // Інші поля
  // ═══════════════════════════════════════════════════════════

  // Відстеження часу
  timeLogs: [timeLogSchema],

  // Оцінка ризику
  risk: riskSchema,
}, {
  timestamps: true, // Автоматично додає createdAt та updatedAt
});

// ═══════════════════════════════════════════════════════════
// Індекси для оптимізації запитів
// ═══════════════════════════════════════════════════════════
// Оптимізовано для:
// 1. EV розрахунків (завершені задачі за датою)
// 2. Загальних запитів задач проекту
// 3. Пошуку задач за виконавцями
// 4. Фільтрації за дедлайном
// ═══════════════════════════════════════════════════════════
taskSchema.index({ projectId: 1, status: 1, updatedAt: -1 }); // Для EV розрахунків
taskSchema.index({ projectId: 1, status: 1 }); // Загальний пошук задач
taskSchema.index({ assignees: 1 }); // Пошук за виконавцями
taskSchema.index({ deadline: 1 }); // Фільтрація за дедлайном

// Pre-save hook для синхронізації plannedValue та plannedCost
taskSchema.pre('save', function(next) {
  // Якщо plannedValue встановлено, синхронізуємо plannedCost
  if (this.plannedValue !== undefined && this.plannedValue !== null) {
    this.plannedCost = this.plannedValue;
  }
  // Якщо plannedCost встановлено, синхронізуємо plannedValue
  if (this.plannedCost !== undefined && this.plannedCost !== null && 
      (this.plannedValue === undefined || this.plannedValue === null)) {
    this.plannedValue = this.plannedCost;
  }
  next();
});

const Task = mongoose.model('Task', taskSchema);

export default Task;
```

---

## Детальний Опис Ключових Полів

### Project.workSchedule

**Призначення:** Визначає робочий розклад проекту для фінансових розрахунків.

**Структура:**
- `workingDays`: Масив номерів днів тижня (0=Неділя, 6=Субота)
  - За замовчуванням: `[1, 2, 3, 4, 5]` (Понеділок-П'ятниця)
  - Валідація: кожен елемент має бути від 0 до 6
- `hoursPerDay`: Кількість робочих годин на день
  - За замовчуванням: `8`
  - Валідація: від 1 до 24

**Використання в розрахунках:**

1. **Конвертація місячних ставок в годинні:**
   ```javascript
   workingDaysPerMonth = (workingDays.length / 7) * 30.4375
   hoursPerMonth = hoursPerDay * workingDaysPerMonth
   hourlyRate = monthlyRate / hoursPerMonth
   ```

2. **Розрахунок робочих днів:**
   ```javascript
   countWorkingDaysInclusive(startDate, endDate, workSchedule)
   // Враховує тільки дні з workSchedule.workingDays
   ```

3. **Розподіл PV по часу:**
   ```javascript
   totalWorkingDays = countWorkingDaysInclusive(taskStartDate, taskDeadline, workSchedule)
   workedDaysUntilTarget = countWorkingDaysInclusive(taskStartDate, targetDate, workSchedule)
   completionRatio = min(1, workedDaysUntilTarget / totalWorkingDays)
   PV_on_date = taskPV * completionRatio
   ```

**Приклад:**
```javascript
{
  workSchedule: {
    workingDays: [1, 2, 3, 4, 5], // Пн-Пт
    hoursPerDay: 8
  }
}
```

### Task.estimateHours

**Призначення:** Оцінка годин для виконання задачі (EFFORT, не тривалість!).

**Важливо:**
- Це **НЕ** тривалість задачі (duration)
- Це загальна кількість годин роботи, необхідна для виконання
- Використовується для розрахунку PV та EV

**Формула розрахунку PV:**
```javascript
effortHours = task.estimateHours
avgHourlyRate = averageHourlyRoleRate(project, task.assignees, referenceDate)
taskPV = effortHours * avgHourlyRate
```

**Приклад:**
```javascript
{
  estimateHours: 40, // 40 годин роботи
  assignees: [userId1, userId2], // 2 виконавці
  // Якщо avgHourlyRate = $50/год, то taskPV = 40 × $50 = $2,000
}
```

### Task.plannedValue

**Призначення:** Запланована вартість (Planned Value) задачі.

**Розрахунок:**
- Автоматично обчислюється: `estimateHours × avgHourlyRate`
- Оновлюється при зміні:
  - `estimateHours`
  - `assignees` (зміна виконавців)
  - Ставок ролей (`project.roles[].currentRate` або `salaryHistory`)

**Використання:**
- Сума PV всіх задач = **Planned Value (PV)** проекту на дату
- PV завершених задач (status = 'Done') = **Earned Value (EV)** проекту
- Сума PV всіх задач = **Budget at Completion (BAC)**

**Приклад:**
```javascript
{
  estimateHours: 40,
  assignees: [userId1, userId2],
  plannedValue: 2000, // Автоматично розраховано
  plannedCost: 2000   // Дублікат для зворотної сумісності
}
```

### Task.plannedCost

**Призначення:** Дублікат `plannedValue` для зворотної сумісності.

**Примітка:** Може бути видалено в майбутніх версіях. Використовуйте `plannedValue`.

---

## Взаємодія з Фінансовим Движком

### Розрахунок PV (Planned Value)

1. **Для кожної задачі:**
   - Отримуємо `task.estimateHours`
   - Отримуємо `task.assignees[]`
   - Для кожного виконавця знаходимо роль та годинну ставку
   - Обчислюємо середню годинну ставку: `avgHourlyRate = average(hourlyRates)`
   - Обчислюємо PV задачі: `taskPV = estimateHours × avgHourlyRate`

2. **Розподіл по часу:**
   - Використовуємо `project.workSchedule` для підрахунку робочих днів
   - Розподіляємо PV лінійно від `task.startDate` до `task.deadline`
   - Враховуємо тільки робочі дні

3. **Сума для всіх задач:**
   - `totalPV = Σ(PV_on_date для кожної задачі)`

### Розрахунок EV (Earned Value)

1. **Фільтрація завершених задач:**
   - `status = 'Done'`
   - `updatedAt <= targetDate`

2. **Обчислення EV:**
   - Для кожної завершеної задачі використовуємо ту саму формулу, що для PV
   - `taskEV = taskPV` (для завершеної задачі)
   - `totalEV = Σ(taskEV для всіх завершених задач)`

### Розрахунок AC (Actual Cost)

1. **Зарплати:**
   - Використовуємо `project.workSchedule` для визначення робочих днів
   - Нараховуємо зарплати тільки на робочі дні
   - Використовуємо `project.roles[].currentRate` або `salaryHistory` для історичної точності

2. **Регулярні витрати:**
   - Використовуємо `Expense` колекцію
   - Враховуємо `frequency` та `createdAt`

3. **Фіксовані витрати:**
   - Використовуємо `project.fixedCosts[]`
   - Враховуємо `frequency` та `project.createdAt`

4. **Ручні транзакції:**
   - Використовуємо `Transaction` колекцію
   - Фільтруємо `type = '-'` та `effectiveDate <= targetDate`

---

## Індекси та Оптимізація

### Project Індекси

```javascript
// Пошук проектів власника
projectSchema.index({ ownerId: 1, isDeleted: 1 });

// Пошук за inviteCode
projectSchema.index({ inviteCode: 1 });

// Пошук EVM snapshots за датою
// (вкладений індекс в evmSnapshots)
```

### Task Індекси

```javascript
// Оптимізація для EV розрахунків (завершені задачі за датою)
taskSchema.index({ projectId: 1, status: 1, updatedAt: -1 });

// Загальний пошук задач проекту
taskSchema.index({ projectId: 1, status: 1 });

// Пошук за виконавцями
taskSchema.index({ assignees: 1 });

// Фільтрація за дедлайном
taskSchema.index({ deadline: 1 });
```

---

## Валідація та Обмеження

### Project.workSchedule

- `workingDays`: Масив має бути непорожнім, кожен елемент 0-6
- `hoursPerDay`: Від 1 до 24

### Task.estimateHours

- Обов'язкове поле
- Мінімальне значення: 0
- Якщо `estimateHours = 0`, то `taskPV = 0` (не fallback на duration!)

### Task.plannedValue та Task.plannedCost

- Автоматично синхронізуються через pre-save hook
- Мінімальне значення: 0

---

## Приклади Використання

### Створення Проекту з Робочим Розкладом

```javascript
const project = new Project({
  name: 'Новий Проект',
  description: 'Опис проекту',
  passwordHash: 'hashed_password',
  ownerId: userId,
  workSchedule: {
    workingDays: [1, 2, 3, 4, 5], // Пн-Пт
    hoursPerDay: 8
  },
  roles: [{
    name: 'Senior Dev',
    currentRate: 6000, // $6,000/міс
    salaryHistory: []
  }]
});

await project.save();
```

### Створення Задачі з Фінансовими Оцінками

```javascript
const task = new Task({
  projectId: project._id,
  title: 'Реалізація функціоналу',
  description: 'Опис задачі',
  status: 'Todo',
  estimateHours: 40, // 40 годин роботи
  assignees: [userId1, userId2],
  startDate: new Date('2024-01-01'),
  deadline: new Date('2024-01-15')
});

// plannedValue буде автоматично розраховано при збереженні
await task.save();
```

### Оновлення Робочого Розкладу

```javascript
project.workSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6], // Всі дні тижня
  hoursPerDay: 10 // 10 годин на день
};

await project.save();
// Всі фінансові розрахунки автоматично оновляться
```

---

## Пов'язана Документація

- **[Фінансова Математика](./financial-math.md)** - Детальний опис формул PV, EV, AC
- **[Схема Бази Даних](./05-database-schema.md)** - Загальний огляд всіх моделей
- **[Фінансовий Движок](./02-financial-engine.md)** - Реалізація EVM розрахунків

---

**Версія:** 1.0  
**Дата:** 2024  
**Автор:** KBM Logic Development Team

