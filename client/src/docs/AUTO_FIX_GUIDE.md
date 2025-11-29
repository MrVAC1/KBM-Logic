# Auto-Fix Utilities Guide

This guide explains the error detection and auto-fix utilities available in the project.

## Overview

The project includes several utilities to help prevent common runtime errors:

1. **Type Declarations** (`src/types/global.d.ts`) - TypeScript definitions for JSX modules
2. **Safe Utilities** (`src/lib/safe-utils.ts`) - Defensive coding helper functions
3. **Error Checker** (`src/scripts/check-errors.js`) - Script to scan for common errors

## Common Errors Fixed

### 1. Array Operations Without Null Checks

**Problem:**
```typescript
// ❌ Crashes if tasks is null/undefined
tasks.filter(t => t.status === 'done')
```

**Solution:**
```typescript
// ✅ Safe with Array.isArray check
const safeTasks = Array.isArray(tasks) ? tasks : []
safeTasks.filter(t => t.status === 'done')

// ✅ Or use safe-utils
import { safeArray } from '@/lib/safe-utils'
safeArray.filter(tasks, t => t.status === 'done')
```

### 2. React Hooks After Early Returns

**Problem:**
```typescript
// ❌ Violates Rules of Hooks
function Component() {
  if (loading) return <Loading />
  const [state, setState] = useState() // Error!
}
```

**Solution:**
```typescript
// ✅ All hooks at the top
function Component() {
  const [state, setState] = useState() // All hooks first
  if (loading) return <Loading />
}
```

### 3. Unsafe Property Access

**Problem:**
```typescript
// ❌ Crashes if user.profile is null
const name = user.profile.name
```

**Solution:**
```typescript
// ✅ Use optional chaining
const name = user?.profile?.name

// ✅ Or use safe-utils
import { safeObject } from '@/lib/safe-utils'
const name = safeObject.get(user, 'profile.name', 'Unknown')
```

## Using Safe Utilities

### Import Safe Utilities

```typescript
import { safeArray, safeObject, safeAsync, safeReact } from '@/lib/safe-utils'
```

### Safe Array Operations

```typescript
// Filter
const doneTasks = safeArray.filter(tasks, t => t.status === 'done')

// Map
const taskTitles = safeArray.map(tasks, t => t.title)

// Find
const task = safeArray.find(tasks, t => t.id === taskId)

// Reduce
const total = safeArray.reduce(tasks, (sum, t) => sum + t.cost, 0)

// Includes
if (safeArray.includes(assignees, userId)) { ... }

// Length
const count = safeArray.length(tasks)

// Ensure array
const safeTasks = safeArray.ensure(tasks, [])
```

### Safe Object Access

```typescript
// Get nested property
const name = safeObject.get(user, 'profile.name', 'Unknown')

// Check if property exists
if (safeObject.has(user, 'profile.name')) { ... }
```

### Safe Async Operations

```typescript
// Execute with error handling
const result = await safeAsync.execute(
  async () => await fetchData(),
  (error) => console.error('Failed:', error)
)

// Execute with default value
const data = await safeAsync.executeWithDefault(
  async () => await fetchData(),
  []
)
```

### Safe React State

```typescript
// Get state or default
const tasks = safeReact.state(tasksState, [])

// Get array state or empty array
const items = safeReact.arrayState(itemsState)
```

## Running Error Checks

### Check for Errors

```bash
npm run check-errors
```

This will scan all `.ts`, `.tsx`, and `.jsx` files and report:
- Unsafe array operations
- React hooks after early returns
- Unsafe property access

### Type Checking

```bash
npm run lint
```

This runs TypeScript compiler to check for type errors.

## Best Practices

### 1. Always Initialize State as Arrays

```typescript
// ✅ Good
const [tasks, setTasks] = useState<any[]>([])

// ❌ Bad
const [tasks, setTasks] = useState<any[]>()
```

### 2. Use Defensive Checks Before Array Operations

```typescript
// ✅ Good
const safeTasks = Array.isArray(tasks) ? tasks : []
const doneTasks = safeTasks.filter(t => t.status === 'done')

// ❌ Bad
const doneTasks = tasks.filter(t => t.status === 'done')
```

### 3. Use Optional Chaining for Nested Properties

```typescript
// ✅ Good
const name = user?.profile?.name ?? 'Unknown'

// ❌ Bad
const name = user.profile.name
```

### 4. Always Call Hooks at Top Level

```typescript
// ✅ Good
function Component() {
  const [state, setState] = useState()
  const data = useMemo(() => compute(), [])
  
  if (loading) return <Loading />
  return <Content />
}

// ❌ Bad
function Component() {
  if (loading) return <Loading />
  const [state, setState] = useState() // Error!
}
```

### 5. Use Try-Catch for Async Operations

```typescript
// ✅ Good
try {
  const data = await fetchData()
  setData(data)
} catch (error) {
  console.error('Failed:', error)
  setData([])
} finally {
  setLoading(false)
}

// Or use safeAsync
const data = await safeAsync.executeWithDefault(
  () => fetchData(),
  []
)
```

## Type Declarations

The project includes type declarations for:

- `@/contexts/AuthContext` - Authentication context types
- `@/contexts/ProjectContext` - Project context types
- `@/config/firebase` - Firebase configuration types
- `firebase/auth` - Firebase auth module types

These are defined in `src/types/global.d.ts` and automatically included by TypeScript.

## Summary

1. **Always check arrays** before using `.filter()`, `.map()`, `.find()`, etc.
2. **Call all hooks** at the top of components, before any early returns
3. **Use optional chaining** (`?.`) for nested property access
4. **Initialize state** with default values (empty arrays, null, etc.)
5. **Use try-catch** or `safeAsync` for async operations
6. **Run `npm run check-errors`** regularly to catch issues early

For more examples, see the actual usage in:
- `src/pages/projects/page.tsx` - Safe array operations
- `src/pages/workspace/financial/page.tsx` - Safe array operations
- `src/pages/login/page.tsx` - React hooks ordering
- `src/components/task-detail-modal.tsx` - Defensive coding patterns


