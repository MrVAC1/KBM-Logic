# Фінансова Математика: KBM Logic v3.1

**Джерело Істини** для розуміння того, як саме обчислюються всі фінансові метрики в системі.

---

## Зміст

1. [Planned Value (PV) - Запланована Вартість](#planned-value-pv)
2. [Actual Cost (AC) - Фактична Вартість](#actual-cost-ac)
3. [Earned Value (EV) - Зароблена Вартість](#earned-value-ev)
4. [Budget at Completion (BAC) - Бюджет на Завершення](#budget-at-completion-bac)
5. [Project Funds - Проектні Кошти](#project-funds)
6. [Burn Rate - Швидкість Витрат](#burn-rate)
7. [Сценарії та Проблеми](#сценарії-та-проблеми)

---

## Planned Value (PV)

### Що це?

**Planned Value (PV)** = Вартість робіт, які ми **ПЛАНУВАЛИ** зробити до певної дати.

Це відповідає на питання: "Скільки ми мали б витратити до сьогодні, якби все йшло за планом?"

### Звідки береться?

**MongoDB Колекції:**
- `Tasks` - всі задачі проекту
- `Projects` - ролі та ставки (`project.roles[]`)

**Поля:**
- `task.estimateHours` - оцінка годин (EFFORT, не тривалість!)
- `task.startDate` - дата початку задачі
- `task.deadline` - дедлайн задачі
- `task.assignees[]` - масив ID користувачів-виконавців
- `project.roles[].name` - назва ролі
- `project.roles[].currentRate` - поточна місячна ставка ролі
- `project.roles[].salaryHistory[]` - історія змін ставок
- `project.workSchedule.workingDays` - робочі дні (за замовчуванням [1,2,3,4,5] = Пн-Пт)
- `project.workSchedule.hoursPerDay` - годин на день (за замовчуванням 8)

### Формула

**Крок 1: Обчислення годинної ставки ролі**

```javascript
// З місячної ставки в годинну
workingDaysPerMonth = (workingDaysCount / 7) * 30.4375
hoursPerMonth = hoursPerDay * workingDaysPerMonth
hourlyRate = monthlyRate / hoursPerMonth
```

**Приклад:**
- Роль: "Senior Dev" з `currentRate = $6,000/міс`
- Графік: Пн-Пт (5 днів), 8 год/день
- `workingDaysPerMonth = (5/7) * 30.4375 = 21.74 днів`
- `hoursPerMonth = 8 * 21.74 = 173.92 годин`
- `hourlyRate = $6,000 / 173.92 = $34.50/год`

**Крок 2: Обчислення PV для однієї задачі**

```javascript
// Для кожної задачі:
effortHours = task.estimateHours  // НЕ duration!
assigneeIds = task.assignees

// Для кожного виконавця знаходимо його роль і годинну ставку
hourlyRates = []
for (assigneeId in assigneeIds) {
  member = project.members.find(m => m.userId === assigneeId)
  roleName = member.roleName || member.roles[0]
  monthlyRate = resolveRoleRateForDate(project, roleName, referenceDate)
  hourlyRate = monthlyRate / hoursPerMonth
  hourlyRates.push(hourlyRate)
}

avgHourlyRate = average(hourlyRates)  // Середнє арифметичне
taskPV = effortHours * avgHourlyRate  // PV = EFFORT × RATE
```

**Крок 3: Розподіл PV по часу (Timeline Distribution)**

```javascript
// PV розподіляється ЛІНІЙНО від startDate до deadline
totalWorkingDays = countWorkingDaysInclusive(taskStartDate, taskDeadline, workSchedule)
workedDaysUntilTarget = countWorkingDaysInclusive(taskStartDate, targetDate, workSchedule)
completionRatio = min(1, workedDaysUntilTarget / totalWorkingDays)

// PV на дату = повний PV × коефіцієнт завершення
PV_on_date = taskPV * completionRatio
```

**Крок 4: Сума PV для всіх задач**

```javascript
totalPV = Σ(PV_on_date для кожної задачі)
```

### Нюанси

1. **Schedule Awareness (Робочі дні):**
   - Вихідні (субота, неділя) **НЕ** враховуються в `countWorkingDaysInclusive()`
   - Якщо `targetDate` випадає на вихідний, PV не змінюється (береться останній робочий день)

2. **Effective Date (Ефективна дата):**
   - Для історичних дат (до сьогодні) використовується кеш з `project.evmSnapshots[]`
   - Якщо snapshot існує, повертається `snapshot.plannedValue` без перерахунку
   - Для сьогодні/майбутнього - обчислення на льоту

3. **Відсутні дані:**
   - Якщо `task.estimateHours = 0` або `null` → `taskPV = 0` (НЕ fallback на duration!)
   - Якщо `task.assignees = []` → `taskPV = 0`
   - Якщо роль не знайдена → `hourlyRate = 0` → `taskPV = 0`

4. **Історія ставок:**
   - `resolveRoleRateForDate()` шукає в `role.salaryHistory[]` найближчу ставку до `referenceDate`
   - Якщо історії немає, використовується `role.currentRate`

### Куди йде?

**Зберігання:**
- `project.evmSnapshots[]` - масив snapshot'ів для кожної дати
- Структура: `{ date: Date, plannedValue: Number, actualCost: Number, earnedValue: Number }`

**Відображення:**
- Dashboard картка "Planned Value (PV)"
- S-Curve графік (синя лінія)

---

## Actual Cost (AC)

### Що це?

**Actual Cost (AC)** = Фактична вартість, яку ми **ВИТРАТИЛИ** до певної дати.

Це відповідає на питання: "Скільки ми реально витратили до сьогодні?"

### Звідки береться?

**MongoDB Колекції:**
- `Projects` - члени команди та ролі
- `Expenses` - регулярні витрати (частотні)
- `Transactions` - ручні транзакції (тип `'-'`)
- `Projects.fixedCosts[]` - фіксовані витрати з налаштувань

**Поля:**
- `project.members[]` - масив членів команди
- `member.roleName` або `member.roles[]` - роль члена
- `member.joinedAt` - дата приєднання до проекту
- `expense.amount` - сума витрати
- `expense.frequency` - частота ('daily', 'weekly', 'monthly', 'yearly')
- `expense.createdAt` - дата створення витрати
- `transaction.amount` - сума транзакції
- `transaction.type` - тип ('+' = дохід, '-' = витрата)
- `transaction.effectiveDate` - ефективна дата (для історичної точності)
- `project.fixedCosts[].amount` - сума фіксованої витрати
- `project.fixedCosts[].frequency` - частота

### Формула

**AC = Зарплати + Регулярні витрати + Фіксовані витрати + Ручні транзакції**

#### 1. Зарплати (Salary Costs)

```javascript
// Тільки на РОБОЧІ дні!
if (!isWorkingDay(targetDate, workSchedule)) {
  salaryCost = 0  // Вихідні = 0
} else {
  for (member in project.members) {
    roleName = member.roleName || member.roles[0]
    monthlyRate = resolveRoleRateForDate(project, roleName, targetDate)
    
    // Враховуємо історію ставок (salaryHistory)
    workingDaysPerMonth = calculateWorkingDaysPerMonth(workSchedule)
    dailyRate = monthlyRate / workingDaysPerMonth
    
    // Враховуємо дату приєднання
    if (member.joinedAt <= targetDate) {
      salaryCost += dailyRate
    }
  }
}
```

**Приклад:**
- Член: "Alice" з роллю "Senior Dev" ($6,000/міс)
- Графік: Пн-Пт, 8 год/день
- `workingDaysPerMonth = 21.74`
- `dailyRate = $6,000 / 21.74 = $275.99/день`
- Якщо сьогодні понеділок → `salaryCost += $275.99`
- Якщо сьогодні субота → `salaryCost = 0`

#### 2. Регулярні витрати (Expenses)

```javascript
for (expense in Expenses.find({ projectId })) {
  expenseStartDate = expense.createdAt
  daysSinceStart = ceil((targetDate - expenseStartDate) / (1000 * 60 * 60 * 24))
  
  switch (expense.frequency) {
    case 'daily':
      expenseCost = expense.amount * daysSinceStart
      break
    case 'weekly':
      expenseCost = expense.amount * ceil(daysSinceStart / 7)
      break
    case 'monthly':
      expenseCost = expense.amount * ceil(daysSinceStart / 30.44)
      break
    case 'yearly':
      expenseCost = expense.amount * ceil(daysSinceStart / 365)
      break
  }
  
  AC += expenseCost
}
```

**Приклад:**
- Витрата: "Server Hosting" $100/міс, створена 1 січня
- Сьогодні: 15 лютого (45 днів)
- `expenseCost = $100 * ceil(45 / 30.44) = $100 * 2 = $200`

#### 3. Фіксовані витрати (Fixed Costs)

```javascript
for (fixedCost in project.fixedCosts) {
  daysSinceStart = ceil((targetDate - project.createdAt) / (1000 * 60 * 60 * 24))
  
  switch (fixedCost.frequency) {
    case 'daily':
      fixedCostAmount = fixedCost.amount * daysSinceStart
      break
    case 'weekly':
      fixedCostAmount = fixedCost.amount * ceil(daysSinceStart / 7)
      break
    case 'monthly':
      fixedCostAmount = fixedCost.amount * ceil(daysSinceStart / 30.44)
      break
    case 'yearly':
      fixedCostAmount = fixedCost.amount * ceil(daysSinceStart / 365)
      break
    case 'one-time':
      fixedCostAmount = fixedCost.amount  // Один раз
      break
  }
  
  AC += fixedCostAmount
}
```

#### 4. Ручні транзакції (Manual Transactions)

```javascript
// Тільки витрати (type === '-')
transactions = Transaction.find({
  projectId,
  type: '-',
  effectiveDate: { $lte: targetDate }  // До дати включно
})

for (transaction in transactions) {
  AC += transaction.amount
}
```

**Важливо:** Транзакції з `effectiveDate` в минулому автоматично тригерять регенерацію snapshots через `regenerateSnapshotsFromDate()`.

### Нюанси

1. **Schedule Awareness:**
   - Зарплати нараховуються **ТІЛЬКИ** на робочі дні
   - Вихідні = 0 для зарплат, але витрати/транзакції завжди враховуються

2. **Effective Date:**
   - `transaction.effectiveDate` дозволяє "заднім числом" додати витрату
   - Система автоматично регенерує snapshots від `effectiveDate` до сьогодні

3. **Кумулятивність:**
   - AC - це **кумулятивна** сума (накопичується з дня створення проекту)
   - Для історичних дат використовується `project.evmSnapshots[].actualCost`

4. **Частота витрат:**
   - `ceil()` завжди округлює вгору (навіть 1 день = 1 період)
   - Це означає, що витрата створена сьогодні вже врахована

### Куди йде?

**Зберігання:**
- `project.evmSnapshots[].actualCost` - кумулятивна AC на дату
- `project.cumulativeActualCost` - поточна кумулятивна AC (для швидкого доступу)

**Відображення:**
- Dashboard картка "Actual Cost (AC)"
- S-Curve графік (червона лінія)

---

## Earned Value (EV)

### Що це?

**Earned Value (EV)** = Вартість робіт, які ми **РЕАЛЬНО ЗАВЕРШИЛИ** до певної дати.

Це відповідає на питання: "Скільки ми мали б витратити, якби все завершене коштувало за планом?"

### Звідки береться?

**MongoDB Колекції:**
- `Tasks` - тільки задачі зі статусом `'Done'`
- `Projects` - ролі та ставки

**Поля:**
- `task.status` - **МАЄ БУТИ** `'Done'`
- `task.updatedAt` - дата завершення (коли статус змінився на 'Done')
- `task.estimateHours` - оцінка годин
- `task.assignees[]` - виконавці
- `project.roles[]` - ролі та ставки

### Формула

```javascript
// Крок 1: Знайти всі завершені задачі
completedTasks = Task.find({
  projectId,
  status: 'Done',  // КРИТИЧНО: тільки 'Done'!
  updatedAt: { $lte: endOfTargetDay }  // Завершені до дати включно
})

// Крок 2: Для кожної завершеної задачі обчислити її PV
totalEV = 0
for (task in completedTasks) {
  // Використовуємо ТУ САМУ функцію, що для PV!
  budget = calculateTaskBudget(project, task, task.updatedAt || date)
  taskEV = budget.plannedValue  // PV завершеної задачі = її EV
  
  totalEV += taskEV
}
```

**Функція `calculateTaskBudget()`:**

```javascript
effortHours = task.estimateHours
avgHourlyRate = averageHourlyRoleRate(project, task.assignees, referenceDate)
taskEV = effortHours * avgHourlyRate  // ТА САМА формула, що для PV!
```

### Нюанси

1. **Статус задачі:**
   - **ТІЛЬКИ** `status = 'Done'` враховується
   - `'Todo'`, `'In Progress'`, `'Review'` → `EV = 0` для цієї задачі

2. **Дата завершення:**
   - Використовується `task.updatedAt` (коли статус змінився на 'Done')
   - Якщо `updatedAt` відсутнє, використовується `targetDate`

3. **Відсутні дані:**
   - Якщо `task.estimateHours = 0` → `taskEV = 0` (логуються попередження)
   - Якщо `task.assignees = []` → `avgHourlyRate = 0` → `taskEV = 0`
   - Якщо роль не знайдена → `hourlyRate = 0` → `taskEV = 0`

4. **Debug логування:**
   - Якщо `taskEV = 0` для завершеної задачі, система логує:
     ```
     [EVM Warning] Task "Task Name" (ID: xxx) has 0 EV. 
     Reason: Estimate=0, Rate=0, PlannedValue=0
     ```

### Куди йде?

**Зберігання:**
- `project.evmSnapshots[].earnedValue` - EV на дату

**Відображення:**
- Dashboard картка "Earned Value (EV)"
- S-Curve графік (зелена лінія)

---

## Budget at Completion (BAC)

### Що це?

**Budget at Completion (BAC)** = Загальний бюджет на весь проект (сума PV всіх задач).

Це відповідає на питання: "Скільки має коштувати весь проект за планом?"

### Звідки береться?

**MongoDB Колекції:**
- `Tasks` - всі задачі проекту (незалежно від статусу)
- `Projects` - ролі та ставки

### Формула

```javascript
tasks = Task.find({ projectId })

totalBAC = 0
for (task in tasks) {
  budget = calculateTaskBudget(project, task, new Date())
  totalBAC += budget.plannedValue  // Сума PV всіх задач
}
```

**BAC = Σ(PV всіх задач)**

### Нюанси

1. **Незалежно від статусу:**
   - Враховуються **ВСІ** задачі (Todo, In Progress, Done)
   - BAC - це план, а не фактичне виконання

2. **Статичний показник:**
   - BAC не змінюється з часом (якщо не додаються нові задачі)
   - Відрізняється від PV, який зростає з часом

### Куди йде?

**Відображення:**
- Dashboard картка "Budget at Completion (BAC)" на Фінансовому Dashboard
- Показує загальний бюджет проєкту та "Remaining Work Budget" (BAC - AC)
- Використовується для обчислення залишку роботи: `Remaining Work Budget = BAC - AC`

**Примітка:** BAC відображається як перша картка на Фінансовому Dashboard, перед карткою PV.

---

## Project Funds

### Що це?

**Project Funds** = Гроші на рахунку проекту (Доходи мінус Витрати).

Це відповідає на питання: "Скільки грошей у нас залишилося?"

### Звідки береться?

**MongoDB Колекції:**
- `Transactions` - тільки транзакції

**Поля:**
- `transaction.type` - тип ('+' = дохід, '-' = витрата)
- `transaction.amount` - сума

### Формула

```javascript
// Всі доходи
incomeTransactions = Transaction.find({
  projectId,
  type: '+'
})
totalIncome = Σ(incomeTransactions.amount)

// Всі витрати (тільки ручні транзакції, НЕ зарплати!)
expenseTransactions = Transaction.find({
  projectId,
  type: '-'
})
totalExpenses = Σ(expenseTransactions.amount)

// Funds = Доходи - Витрати
projectFunds = totalIncome - totalExpenses
```

### Нюанси

1. **Відокремлення від AC:**
   - **Funds** = гроші (Cash Flow)
   - **AC** = витрати на роботу (включає зарплати, витрати, транзакції)
   - Зарплати **НЕ** враховуються в Funds (вони вже в AC)

2. **Тільки транзакції:**
   - Регулярні витрати (`Expenses`) та фіксовані витрати (`fixedCosts`) **НЕ** враховуються
   - Тільки ручні транзакції з "Manage Funds"

### Куди йде?

**Відображення:**
- Dashboard картка "Project Funds"
- Використовується для обчислення "Runway" = `Funds / Instant Burn Rate`

---

## Burn Rate

### Що це?

**Burn Rate** = Швидкість витрат грошей (скільки витрачаємо на місяць).

### Звідки береться?

**MongoDB Колекції:**
- `Projects` - для `createdAt` (дата початку проекту)
- `Projects.evmSnapshots[]` - для історичних AC

### Формула

#### Average Burn Rate (Середня швидкість)

```javascript
projectStartDate = project.createdAt
today = new Date()
projectDurationDays = ceil((today - projectStartDate) / (1000 * 60 * 60 * 24))
projectDurationMonths = projectDurationDays / 30.4375  // Середні дні на місяць

currentAC = calculateAC(project, today)
averageBurnRate = currentAC / projectDurationMonths
```

**Приклад:**
- Проект створений: 1 січня
- Сьогодні: 1 березня (59 днів)
- `projectDurationMonths = 59 / 30.4375 = 1.94 місяці`
- `currentAC = $50,000`
- `averageBurnRate = $50,000 / 1.94 = $25,773/міс`

#### Instant Burn Rate (Миттєва швидкість)

```javascript
sevenDaysAgo = new Date(today)
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
acSevenDaysAgo = calculateAC(project, sevenDaysAgo)

instantBurnRate = (currentAC - acSevenDaysAgo) / (7 / 30.4375)
// 7 днів як частка місяця
```

**Приклад:**
- `currentAC = $50,000`
- `acSevenDaysAgo = $48,000`
- `instantBurnRate = ($50,000 - $48,000) / (7 / 30.4375) = $2,000 / 0.23 = $8,696/міс`

### Нюанси

1. **Два типи:**
   - **Average** - середня швидкість за весь період проекту
   - **Instant** - швидкість за останні 7 днів (більш актуальна)

2. **Runway (Злітна смуга):**
   - `runwayMonths = projectFunds / instantBurnRate`
   - Якщо `instantBurnRate = 0` → `runwayMonths = null` (нескінченно)

### Куди йде?

**Відображення:**
- Dashboard картка "Burn Rate" (показує Instant)
- Використовується для обчислення "Runway"

---

## Сценарії та Проблеми

### Сценарій 1: "Чому EV = $0?"

**Причини:**

1. **Задачі не завершені:**
   - `task.status !== 'Done'` → `EV = 0` для цієї задачі

2. **Відсутній `estimateHours`:**
   - `task.estimateHours = 0` або `null` → `taskEV = 0`
   - **Рішення:** Встановити `estimateHours > 0` для задачі

3. **Відсутні виконавці:**
   - `task.assignees = []` → `avgHourlyRate = 0` → `taskEV = 0`
   - **Рішення:** Призначити виконавців з ролями

4. **Відсутня роль або ставка:**
   - Роль не знайдена або `role.currentRate = 0` → `hourlyRate = 0` → `taskEV = 0`
   - **Рішення:** Створити роль з `currentRate > 0`

5. **Stale snapshots:**
   - Історичні snapshots не оновлені після зміни ставок/оцінок
   - **Рішення:** Натиснути "Recalculate Financial Data" в Danger Zone

**Debug:**
- Перевірити логи: `[EVM Warning] Task "..." has 0 EV. Reason: Estimate=X, Rate=Y`

---

### Сценарій 2: "Чому AC різко зріс?"

**Причини:**

1. **Додана велика транзакція:**
   - `Transaction` з `type = '-'` та великим `amount`
   - Якщо `effectiveDate` в минулому, система регенерує snapshots

2. **Додана регулярна витрата:**
   - `Expense` з `frequency = 'monthly'` та великим `amount`
   - Витрата накопичується з `createdAt`

3. **Додано нового члена команди:**
   - Новий `member` з дорогою роллю → додається `dailyRate` на кожен робочий день

4. **Змінена ставка ролі:**
   - `role.currentRate` збільшено → `dailyRate` зростає для всіх членів з цією роллю

**Debug:**
- Перевірити `project.evmSnapshots[]` - яка дата має різкий стрибок `actualCost`
- Перевірити `Transaction` з `effectiveDate` на цю дату
- Перевірити `Expense` з `createdAt` до цієї дати

---

### Сценарій 3: "Budget vs Funds - в чому різниця?"

**Budget (BAC):**
- Це **планована вартість роботи** (сума PV всіх задач)
- Не залежить від грошей на рахунку
- Приклад: `BAC = $100,000` (план на роботу)

**Funds:**
- Це **гроші на рахунку** (Доходи - Витрати)
- Не залежить від планової вартості роботи
- Приклад: `Funds = $80,000` (гроші в банку)

**Взаємозв'язок:**
- `Remaining Work Budget = BAC - AC` (скільки бюджету залишилося на роботу)
- `Runway = Funds / Burn Rate` (скільки місяців протримаємося на грошах)

**Приклад:**
- `BAC = $100,000` (план)
- `AC = $60,000` (витрачено)
- `Remaining Work Budget = $40,000` (залишилося на роботу)
- `Funds = $50,000` (гроші в банку)
- `Burn Rate = $10,000/міс`
- `Runway = $50,000 / $10,000 = 5 місяців`

---

### Сценарій 4: "Чому PV не зростає на вихідні?"

**Причина:**
- `countWorkingDaysInclusive()` враховує **тільки робочі дні**
- Вихідні (субота, неділя) = 0 робочих днів
- `completionRatio` не змінюється на вихідні → `PV` не зростає

**Приклад:**
- Задача: Пн-Пт (5 робочих днів), `taskPV = $1,000`
- Понеділок: `completionRatio = 1/5 = 0.2` → `PV = $200`
- Вівторок: `completionRatio = 2/5 = 0.4` → `PV = $400`
- Субота: `completionRatio = 5/5 = 1.0` → `PV = $1,000` (не змінюється з п'ятниці)

---

### Сценарій 5: "Як працює Effective Date?"

**Концепція:**
- `effectiveDate` дозволяє "заднім числом" додати транзакцію
- `createdAt` зберігає час створення (аудит)
- `effectiveDate` визначає фінансовий вплив

**Процес:**

1. **Створення транзакції:**
   ```javascript
   transaction = {
     amount: -$5,000,
     type: '-',
     effectiveDate: '2024-01-15',  // В минулому!
     createdAt: '2024-02-20'  // Сьогодні
   }
   ```

2. **Автоматична регенерація:**
   ```javascript
   if (effectiveDate < today) {
     regenerateSnapshotsFromDate(projectId, effectiveDate)
   }
   ```

3. **Результат:**
   - Всі snapshots від `2024-01-15` до сьогодні перераховуються
   - `AC` на `2024-01-15` та всі наступні дати збільшуються на $5,000
   - S-Curve графік оновлюється автоматично

**Використання:**
- Виправлення помилок в минулому
- Додавання забутих витрат
- Корекція історичних даних

---

## Висновок

Цей документ є **джерелом істини** для розуміння фінансової математики KBM Logic v3.1.

**Ключові принципи:**

1. **PV = EFFORT × RATE** (не duration!)
2. **EV = PV завершених задач** (тільки `status = 'Done'`)
3. **AC = Зарплати + Витрати + Транзакції** (кумулятивно)
4. **Funds = Доходи - Витрати** (гроші, не бюджет)
5. **Schedule Awareness** - вихідні = 0 для зарплат та PV
6. **Effective Date** - історична точність через регенерацію snapshots

**Якщо щось не працює:**
1. Перевірте логи: `[EVM Warning]` повідомлення
2. Перевірте дані: `estimateHours`, `status`, `assignees`, `role.currentRate`
3. Використайте "Recalculate Financial Data" (Налаштування → Danger Zone) для оновлення snapshots
4. Переконайтеся, що `task.updatedAt` встановлено правильно для завершених задач (для EV розрахунків)

---

**Версія:** 3.1  
**Дата:** 2024  
**Автор:** KBM Logic Development Team

---

## Додаток: S-Curve "Carry Forward" Логіка

### Проблема: "Drop to Zero" Glitch

Коли снапшот для поточної дати ще не згенерований, графік S-Curve може показати `AC = 0` або `EV = 0`, навіть якщо метрики на картках показують високі значення.

### Рішення: Carry Forward

**Логіка на Frontend (`client/src/pages/workspace/financial/page.tsx`):**

```javascript
// Якщо значення відсутнє або 0, використовуємо останнє відоме значення
let lastAC = null;
let lastEV = null;

for (point in evmDataPoints) {
  if (point.AC === null || point.AC === 0) {
    if (lastAC !== null && lastAC > 0) {
      point.AC = lastAC;  // Carry forward
    }
  } else {
    lastAC = point.AC;  // Оновлюємо останнє відоме значення
  }
  
  // Аналогічно для EV
  if (point.EV === null || point.EV === 0) {
    if (lastEV !== null && lastEV > 0) {
      point.EV = lastEV;  // Carry forward
    }
  } else {
    lastEV = point.EV;
  }
}
```

**Результат:**
- Лінії AC та EV **НІКОЛИ** не падають до 0, якщо вони мали позитивне значення раніше
- Лінії залишаються **горизонтальними** (flat) коли снапшот відсутній
- Для поточної дати використовується значення з summary statistics (`stats.current.AC`, `stats.current.EV`)

**Примітка:** PV завжди доступна (може бути 0, якщо немає задач), тому carry forward не потрібен для PV.

