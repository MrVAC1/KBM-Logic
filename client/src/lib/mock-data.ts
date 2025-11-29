// Mock data structure simulating database relationships

export interface User {
  id: string
  email: string
  nickname: string
  avatar: string
  birthDate: string
  location: string
  bio: string
  role: string | null
  salary?: number
  department?: string
  permissions: string[]
  isOnboarded: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  owner: string
  password: string
  totalBudget: number
  actualSpent: number
  members: string[]
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  complexity: "low" | "medium" | "high"
  status: "todo" | "in-progress" | "review" | "done"
  assignees: string[]
  department?: string
  everyoneCanClaim: boolean
  deadline: string
  estimatedCost: number
  actualCost: number
  riskProbability: number
  riskImpact: number
  timeTracking: {
    userId: string
    startTime: string | null
    totalHours: number
  }[]
  createdAt: string
}

export interface Transaction {
  id: string
  projectId: string
  type: "income" | "expense"
  amount: number
  source: string
  reason: string
  date: string
  userId: string
}

export interface FixedCost {
  id: string
  projectId: string
  name: string
  amount: number
  frequency: "monthly"
  category: string
}

export interface Department {
  id: string
  projectId: string
  name: string
  members: string[]
}

export interface Role {
  id: string
  projectId: string
  name: string
  permissions: string[]
  hierarchy: number
  color: string
  isOwner: boolean
}

// Mock current user
export const mockCurrentUser: User = {
  id: "user-1",
  email: "john@example.com",
  nickname: "John Dev",
  avatar: "/diverse-avatars.png",
  birthDate: "1990-05-15",
  location: "San Francisco, CA",
  bio: "Full-stack developer passionate about project management",
  role: "developer",
  permissions: ["can_track_time", "edit_tasks"],
  isOnboarded: true,
}

// Mock users
export const mockUsers: User[] = [
  mockCurrentUser,
  {
    id: "user-2",
    email: "sarah@example.com",
    nickname: "Sarah Manager",
    avatar: "/diverse-team-manager.png",
    birthDate: "1988-03-20",
    location: "New York, NY",
    bio: "Project manager with 10 years experience",
    role: "manager",
    salary: 120000,
    permissions: ["edit_budget", "manage_roles", "can_track_time", "edit_tasks"],
    isOnboarded: true,
  },
  {
    id: "user-3",
    email: "mike@example.com",
    nickname: "Mike Designer",
    avatar: "/diverse-designers-brainstorming.png",
    birthDate: "1992-11-08",
    location: "Austin, TX",
    bio: "UI/UX Designer",
    role: "designer",
    department: "Design",
    permissions: ["edit_tasks"],
    isOnboarded: true,
  },
]

// Mock projects
export const mockProjects: Project[] = [
  {
    id: "project-1",
    name: "Enterprise Dashboard Redesign",
    description: "Complete redesign of the internal analytics dashboard",
    owner: "user-2",
    password: "demo123",
    totalBudget: 250000,
    actualSpent: 178500,
    members: ["user-1", "user-2", "user-3"],
    createdAt: "2025-01-15",
  },
  {
    id: "project-2",
    name: "Mobile App Launch",
    description: "iOS and Android app development",
    owner: "user-1",
    password: "mobile456",
    totalBudget: 180000,
    actualSpent: 92000,
    members: ["user-1", "user-3"],
    createdAt: "2025-02-01",
  },
]

// Mock tasks
export const mockTasks: Task[] = [
  {
    id: "task-1",
    projectId: "project-1",
    title: "Design new navigation system",
    description: "Create wireframes and prototypes for the new navigation",
    complexity: "high",
    status: "in-progress",
    assignees: ["user-3"],
    department: "Design",
    everyoneCanClaim: false,
    deadline: "2025-12-02",
    estimatedCost: 8500,
    actualCost: 4200,
    riskProbability: 4,
    riskImpact: 4,
    timeTracking: [
      {
        userId: "user-3",
        startTime: null,
        totalHours: 28,
      },
    ],
    createdAt: "2025-11-20",
  },
  {
    id: "task-2",
    projectId: "project-1",
    title: "Implement authentication flow",
    description: "Set up OAuth and session management",
    complexity: "medium",
    status: "review",
    assignees: ["user-1"],
    everyoneCanClaim: false,
    deadline: "2025-11-28",
    estimatedCost: 5000,
    actualCost: 5200,
    riskProbability: 2,
    riskImpact: 5,
    timeTracking: [
      {
        userId: "user-1",
        startTime: null,
        totalHours: 34,
      },
    ],
    createdAt: "2025-11-15",
  },
  {
    id: "task-3",
    projectId: "project-1",
    title: "Database optimization",
    description: "Optimize slow queries and add indexes",
    complexity: "low",
    status: "todo",
    assignees: [],
    everyoneCanClaim: true,
    deadline: "2025-12-10",
    estimatedCost: 2000,
    actualCost: 0,
    riskProbability: 1,
    riskImpact: 2,
    timeTracking: [],
    createdAt: "2025-11-25",
  },
]

// Mock transactions
export const mockTransactions: Transaction[] = [
  {
    id: "trans-1",
    projectId: "project-1",
    type: "income",
    amount: 250000,
    source: "Initial Funding",
    reason: "Project kickoff budget",
    date: "2025-01-15",
    userId: "user-2",
  },
  {
    id: "trans-2",
    projectId: "project-1",
    type: "expense",
    amount: 15000,
    source: "Software Licenses",
    reason: "Adobe Creative Cloud, Figma Enterprise",
    date: "2025-01-20",
    userId: "user-2",
  },
  {
    id: "trans-3",
    projectId: "project-1",
    type: "expense",
    amount: 42500,
    source: "Developer Salaries",
    reason: "January payroll",
    date: "2025-02-01",
    userId: "user-2",
  },
]

// Mock fixed costs
export const mockFixedCosts: FixedCost[] = [
  {
    id: "fixed-1",
    projectId: "project-1",
    name: "Senior Developer Salary",
    amount: 12000,
    frequency: "monthly",
    category: "Salaries",
  },
  {
    id: "fixed-2",
    projectId: "project-1",
    name: "Office Rent",
    amount: 3500,
    frequency: "monthly",
    category: "Facilities",
  },
  {
    id: "fixed-3",
    projectId: "project-1",
    name: "Cloud Infrastructure",
    amount: 2800,
    frequency: "monthly",
    category: "Technology",
  },
]

// Mock departments
export const mockDepartments: Department[] = [
  {
    id: "dept-1",
    projectId: "project-1",
    name: "Design",
    members: ["user-3"],
  },
  {
    id: "dept-2",
    projectId: "project-1",
    name: "Engineering",
    members: ["user-1"],
  },
]

// Mock roles
export const mockRoles: Role[] = [
  {
    id: "role-1",
    projectId: "project-1",
    name: "Owner",
    permissions: ["edit_budget", "manage_roles", "can_track_time", "edit_tasks", "delete_project"],
    hierarchy: 1,
    color: "#06b6d4",
    isOwner: true,
  },
  {
    id: "role-2",
    projectId: "project-1",
    name: "Manager",
    permissions: ["edit_budget", "manage_roles", "can_track_time", "edit_tasks"],
    hierarchy: 2,
    color: "#3b82f6",
    isOwner: false,
  },
  {
    id: "role-3",
    projectId: "project-1",
    name: "Developer",
    permissions: ["can_track_time", "edit_tasks"],
    hierarchy: 3,
    color: "#10b981",
    isOwner: false,
  },
]

