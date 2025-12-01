"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Users, Trash2, Shield, Ban, UserCheck, Settings2, UserCog, Loader2, Check, DollarSign, Edit2 } from "lucide-react"
import { projects as projectsAPI, users as usersAPI, expenses as expensesAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import { format } from "date-fns"
import { CreateDepartmentModal } from "./create-department-modal"
import { DepartmentDetailModal } from "./department-detail-modal"
import { BlockUserModal } from "./block-user-modal"
import { EditMemberRolesModal } from "./edit-member-roles-modal"
import { ManageDepartmentMembersModal } from "./manage-department-members-modal"
import { ExpenseModal } from "./expense-modal"

interface Department {
  id: string
  name: string
  memberIds: string[]
  memberCount: number
  createdAt: string
}

interface ProjectMember {
  _id: string
  userId: string
  uid: string
  email: string
  displayName: string
  avatar: string
  roleName: string
  roles?: string[] // Multiple roles support
  joinedAt: string
  activeTaskCount: number
  isOwner: boolean
  monthlySalary?: number
}

interface Role {
  name: string
  permissions: string[]
  color: string
  isOwner?: boolean
  isDefault?: boolean
}

interface BannedUser {
  userId: string
  email: string
  reason: string
  bannedAt: string
  bannedBy: string
}

export function TeamsTab() {
  const { currentProject, hasPermission, isOwner } = useProject()
  const projectId = currentProject?.id || currentProject?._id

  // Departments state
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(true)
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: string; name: string } | null>(null)
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null)
  const [showDeleteDeptDialog, setShowDeleteDeptDialog] = useState(false)

  // Members state
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null)
  const [blockingUserName, setBlockingUserName] = useState("")
  const [showBlockModal, setShowBlockModal] = useState(false)

  // Banned users state
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
  const [bannedUsersLoading, setBannedUsersLoading] = useState(true)
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null)

  // Department member management state
  const [managingDepartment, setManagingDepartment] = useState<{ id: string; name: string; memberIds: string[] } | null>(null)

  // Edit member roles state
  const [editingMember, setEditingMember] = useState<{ id: string; name: string; avatar?: string; roles: string[] } | null>(null)
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])

  const canManageSettings = hasPermission('can_manage_settings')
  const canManageRoles = hasPermission('can_manage_roles')
  const canManageSalaries = hasPermission('can_manage_salaries')

  // Salary editing state (for Costs tab)
  const [editingSalaryUserId, setEditingSalaryUserId] = useState<string | null>(null)
  const [salaryValues, setSalaryValues] = useState<Record<string, string>>({})
  const [savingSalaryUserId, setSavingSalaryUserId] = useState<string | null>(null)

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any | null>(null)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [showDeleteExpenseDialog, setShowDeleteExpenseDialog] = useState(false)

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    if (!projectId) {
      setDepartmentsLoading(false)
      return
    }

    try {
      setDepartmentsLoading(true)
      const response = await projectsAPI.getDepartments(projectId)
      const data = response.data?.data || response.data
      setDepartments(data.departments || [])
    } catch (error: any) {
      console.error('Failed to fetch departments:', error)
      toast.error(error.response?.data?.message || 'Failed to load departments')
      setDepartments([])
    } finally {
      setDepartmentsLoading(false)
    }
  }, [projectId])

  // Fetch members with active task counts
  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setMembersLoading(false)
      return
    }

    try {
      setMembersLoading(true)
      const response = await projectsAPI.getMembers(projectId)
      const data = response.data?.data || response.data
      const membersList = data.members || []
      setMembers(membersList)
      
      // Initialize salary values from fetched members
      const initialSalaryValues: Record<string, string> = {}
      membersList.forEach((member: ProjectMember) => {
        if (member.monthlySalary !== undefined && member.monthlySalary !== null) {
          initialSalaryValues[member.userId] = member.monthlySalary.toString()
        }
      })
      setSalaryValues(initialSalaryValues)
    } catch (error: any) {
      console.error('Failed to fetch members:', error)
      toast.error(error.response?.data?.message || 'Failed to load members')
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [projectId])

  // Fetch banned users
  const fetchBannedUsers = useCallback(async () => {
    if (!projectId) {
      setBannedUsersLoading(false)
      return
    }

    try {
      setBannedUsersLoading(true)
      const response = await projectsAPI.getBannedUsers(projectId)
      const data = response.data?.data || response.data
      setBannedUsers(data.bannedUsers || [])
    } catch (error: any) {
      console.error('Failed to fetch banned users:', error)
      toast.error(error.response?.data?.message || 'Failed to load banned users')
      setBannedUsers([])
    } finally {
      setBannedUsersLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchBannedUsers()
  }, [fetchBannedUsers])

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    if (!projectId) {
      setExpensesLoading(false)
      return
    }

    try {
      setExpensesLoading(true)
      const response = await expensesAPI.getByProject(projectId)
      const data = response.data?.data || response.data
      setExpenses(data.expenses || [])
    } catch (error: any) {
      console.error('Failed to fetch expenses:', error)
      toast.error(error.response?.data?.message || 'Failed to load expenses')
      setExpenses([])
    } finally {
      setExpensesLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Fetch available roles for role assignment
  useEffect(() => {
    if (editingMember && projectId) {
      fetchAvailableRoles()
    }
  }, [editingMember, projectId])

  const fetchAvailableRoles = async () => {
    if (!projectId) return

    try {
      const response = await projectsAPI.getRoles(projectId)
      const data = response.data?.data || response.data
      setAvailableRoles(data.roles || [])
    } catch (error: any) {
      console.error('Failed to fetch roles:', error)
      toast.error(error.response?.data?.message || 'Failed to load roles')
      setAvailableRoles([])
    }
  }

  // Handle department deletion
  const handleDeleteDepartment = async (departmentId: string) => {
    if (!projectId) return

    setDeletingDepartmentId(departmentId)

    try {
      await projectsAPI.deleteDepartment(projectId, departmentId)
      toast.success('Department deleted successfully')
      setShowDeleteDeptDialog(false)
      setDeletingDepartmentId(null)
      await fetchDepartments()
    } catch (error: any) {
      console.error('Failed to delete department:', error)
      toast.error(error.response?.data?.message || 'Failed to delete department')
      setDeletingDepartmentId(null)
    }
  }

  // Handle blocking user
  const handleBlockUser = (userId: string, userName: string) => {
    setBlockingUserId(userId)
    setBlockingUserName(userName)
    setShowBlockModal(true)
  }

  const handleUserBlocked = async () => {
    await Promise.all([fetchMembers(), fetchBannedUsers(), fetchDepartments()])
  }

  // Handle unblocking user
  const handleUnblockUser = async (userId: string) => {
    if (!projectId) return

    setUnblockingUserId(userId)

    try {
      await projectsAPI.unblockMember(projectId, userId)
      toast.success('User unblocked successfully')
      await fetchBannedUsers()
      await fetchMembers()
    } catch (error: any) {
      console.error('Failed to unblock user:', error)
      toast.error(error.response?.data?.message || 'Failed to unblock user')
    } finally {
      setUnblockingUserId(null)
    }
  }

  // Handle salary input change
  const handleSalaryChange = (userId: string, value: string) => {
    setSalaryValues(prev => ({
      ...prev,
      [userId]: value
    }))
    setEditingSalaryUserId(userId)
  }

  // Handle saving salary
  const handleSaveSalary = async (userId: string) => {
    if (!projectId || !canManageSalaries) return

    const salaryValue = salaryValues[userId]
    if (salaryValue === undefined || salaryValue === '') {
      // Reset to original value if empty
      const member = members.find(m => m.userId === userId)
      if (member?.monthlySalary !== undefined) {
        setSalaryValues(prev => ({
          ...prev,
          [userId]: member.monthlySalary?.toString() || '0'
        }))
      }
      setEditingSalaryUserId(null)
      return
    }

    const salaryNum = parseFloat(salaryValue)
    if (isNaN(salaryNum) || salaryNum < 0) {
      toast.error('Salary must be a valid non-negative number')
      // Reset to original value
      const member = members.find(m => m.userId === userId)
      if (member?.monthlySalary !== undefined) {
        setSalaryValues(prev => ({
          ...prev,
          [userId]: member.monthlySalary?.toString() || '0'
        }))
      }
      setEditingSalaryUserId(null)
      return
    }

    setSavingSalaryUserId(userId)

    try {
      await usersAPI.updateSalary(projectId, userId, salaryNum)
      toast.success('Salary updated successfully')
      
      // Update local state optimistically
      setMembers(prevMembers =>
        prevMembers.map(m =>
          m.userId === userId ? { ...m, monthlySalary: salaryNum } : m
        )
      )
      
      setEditingSalaryUserId(null)
    } catch (error: any) {
      console.error('Failed to update salary:', error)
      toast.error(error.response?.data?.message || 'Failed to update salary')
      
      // Revert to original value on error
      const member = members.find(m => m.userId === userId)
      if (member?.monthlySalary !== undefined) {
        setSalaryValues(prev => ({
          ...prev,
          [userId]: member.monthlySalary?.toString() || '0'
        }))
      }
    } finally {
      setSavingSalaryUserId(null)
    }
  }

  // Handle salary input blur (save on blur if changed)
  const handleSalaryBlur = (userId: string) => {
    const member = members.find(m => m.userId === userId)
    const currentValue = salaryValues[userId]
    const originalValue = member?.monthlySalary?.toString() || '0'
    
    if (currentValue !== originalValue) {
      handleSaveSalary(userId)
    } else {
      setEditingSalaryUserId(null)
    }
  }

  // Handle expense creation/update from modal
  const handleExpenseSubmit = async (data?: { name: string; amount: number; frequency: string }) => {
    if (!projectId || !canManageSettings || !data) return

    try {
      if (editingExpense?._id || editingExpense?.id) {
        // Update existing expense
        const expenseId = editingExpense._id || editingExpense.id
        await expensesAPI.update(projectId, expenseId, data)
        toast.success('Expense updated successfully')
      } else {
        // Create new expense
        await expensesAPI.create(projectId, data)
        toast.success('Expense created successfully')
      }
      
      setShowExpenseModal(false)
      setEditingExpense(null)
      await fetchExpenses()
    } catch (error: any) {
      console.error('Failed to save expense:', error)
      toast.error(error.response?.data?.message || 'Failed to save expense')
    }
  }

  // Handle expense deletion
  const handleDeleteExpense = async () => {
    if (!projectId || !deletingExpenseId) return

    try {
      await expensesAPI.delete(projectId, deletingExpenseId)
      toast.success('Expense deleted successfully')
      setShowDeleteExpenseDialog(false)
      setDeletingExpenseId(null)
      await fetchExpenses()
    } catch (error: any) {
      console.error('Failed to delete expense:', error)
      toast.error(error.response?.data?.message || 'Failed to delete expense')
      setDeletingExpenseId(null)
    }
  }

  const handleOpenExpenseModal = (expense?: any) => {
    setEditingExpense(expense || { name: '', amount: '' })
    setShowExpenseModal(true)
  }

  const handleCloseExpenseModal = () => {
    setShowExpenseModal(false)
    setEditingExpense(null)
  }

  return (
    <div className="space-y-6">
      {/* Modals */}
      <CreateDepartmentModal
        open={showCreateDeptModal}
        onOpenChange={setShowCreateDeptModal}
        projectId={projectId || ''}
        onSuccess={fetchDepartments}
      />

      {selectedDepartment && (
        <DepartmentDetailModal
          open={!!selectedDepartment}
          onOpenChange={(open) => !open && setSelectedDepartment(null)}
          projectId={projectId || ''}
          departmentId={selectedDepartment.id}
          departmentName={selectedDepartment.name}
          onMemberRemoved={() => {
            fetchDepartments()
            fetchMembers()
          }}
        />
      )}

      {blockingUserId && (
        <BlockUserModal
          open={showBlockModal}
          onOpenChange={(open) => {
            if (!open) {
              setShowBlockModal(false)
              setBlockingUserId(null)
              setBlockingUserName("")
            }
          }}
          projectId={projectId || ''}
          userId={blockingUserId}
          userName={blockingUserName}
          onBlocked={handleUserBlocked}
        />
      )}

      {managingDepartment && (
        <ManageDepartmentMembersModal
          open={!!managingDepartment}
          onOpenChange={(open) => !open && setManagingDepartment(null)}
          projectId={projectId || ''}
          departmentId={managingDepartment.id}
          departmentName={managingDepartment.name}
          departmentMemberIds={managingDepartment.memberIds}
          onSuccess={() => {
            fetchDepartments()
            fetchMembers()
          }}
        />
      )}

      {editingMember && (
        <EditMemberRolesModal
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          projectId={projectId || ''}
          memberId={editingMember.id}
          memberName={editingMember.name}
          memberAvatar={editingMember.avatar}
          currentRoles={editingMember.roles}
          availableRoles={availableRoles}
          onSuccess={() => {
            fetchMembers()
            setEditingMember(null)
          }}
        />
      )}

      {/* Delete Department Confirmation Dialog */}
      <AlertDialog open={showDeleteDeptDialog} onOpenChange={setShowDeleteDeptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be undone.
              <br />
              <span className="text-destructive font-medium">
                All members will be removed from this department.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingDepartmentId) {
                  handleDeleteDepartment(deletingDepartmentId)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingDepartmentId}
            >
              {deletingDepartmentId ? 'Deleting...' : 'Delete Department'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <Tabs defaultValue="departments" className="w-full">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="members">All Members</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="banned">Blocked Users</TabsTrigger>
        </TabsList>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Teams & Departments</CardTitle>
                  <CardDescription>Create and manage organizational groups</CardDescription>
                </div>
                {canManageSettings && (
                  <Button
                    onClick={() => setShowCreateDeptModal(true)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Department
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {departmentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Loading departments...</p>
                </div>
              ) : departments.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No departments yet. Create your first one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {departments.map((dept) => (
                    <Card
                      key={dept.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setSelectedDepartment({ id: dept.id, name: dept.name })}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Users className="h-5 w-5 text-primary" />
                            <div>
                              <h3 className="font-semibold text-lg">{dept.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {dept.memberCount} {dept.memberCount === 1 ? 'member' : 'members'}
                              </p>
                            </div>
                            <Badge variant="secondary">{dept.memberCount}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {canManageSettings && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setManagingDepartment({ id: dept.id, name: dept.name, memberIds: dept.memberIds })
                                  }}
                                >
                                  <Settings2 className="h-4 w-4 mr-2" />
                                  Manage Members
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeletingDepartmentId(dept.id)
                                    setShowDeleteDeptDialog(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>View and manage all project members</CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Loading members...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No members found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Active Tasks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member._id || member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.displayName} />
                              <AvatarFallback className="text-xs">
                                {member.displayName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.displayName}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            {member.isOwner && (
                              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            {(() => {
                              // Support both roles array and legacy roleName
                              const memberRoles = Array.isArray(member.roles) && member.roles.length > 0
                                ? member.roles
                                : (member.roleName ? [member.roleName] : ['Guest'])
                              
                              // Show first 3 roles, then "+X more" if there are more
                              const displayRoles = memberRoles.slice(0, 3)
                              const remainingCount = memberRoles.length - 3
                              
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {displayRoles.map((roleName, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {roleName}
                                    </Badge>
                                  ))}
                                  {remainingCount > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{remainingCount} more
                                    </Badge>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(member.joinedAt), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.activeTaskCount > 0 ? "default" : "secondary"}>
                            {member.activeTaskCount} active
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canManageRoles && !member.isOwner && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const memberRoles = Array.isArray(member.roles) && member.roles.length > 0
                                    ? member.roles
                                    : (member.roleName ? [member.roleName] : ['Guest'])
                                  setEditingMember({
                                    id: member._id || member.userId,
                                    name: member.displayName,
                                    avatar: member.avatar,
                                    roles: memberRoles,
                                  })
                                }}
                              >
                                <UserCog className="h-4 w-4 mr-2" />
                                Edit Roles
                              </Button>
                            )}
                            {canManageSettings && !member.isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBlockUser(member.userId, member.displayName)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Block
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Costs & Expenses</CardTitle>
                  <CardDescription>Manage employee salaries and project expenses</CardDescription>
                </div>
                {canManageSettings && (
                  <Button
                    onClick={() => handleOpenExpenseModal()}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Salaries Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Employee Salaries</h3>
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">Loading members...</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">No members found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <Card key={member._id || member.userId} className="border-border">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.displayName} />
                                <AvatarFallback className="text-xs">
                                  {member.displayName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{member.displayName}</p>
                                  {member.isOwner && (
                                    <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {(() => {
                                    const memberRoles = Array.isArray(member.roles) && member.roles.length > 0
                                      ? member.roles
                                      : (member.roleName ? [member.roleName] : ['Guest'])
                                    return (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {memberRoles.slice(0, 2).map((roleName, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            {roleName}
                                          </Badge>
                                        ))}
                                        {memberRoles.length > 2 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{memberRoles.length - 2} more
                                          </Badge>
                                        )}
                                      </div>
                                    )
                                  })()}
                                  <span className="text-xs text-muted-foreground">
                                    Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {canManageSalaries && (
                              <div className="flex items-center gap-2 w-40">
                                {savingSalaryUserId === member.userId ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : editingSalaryUserId === member.userId ? (
                                  <div className="flex items-center gap-1 flex-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={salaryValues[member.userId] || member.monthlySalary?.toString() || '0'}
                                      onChange={(e) => handleSalaryChange(member.userId, e.target.value)}
                                      onBlur={() => handleSalaryBlur(member.userId)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveSalary(member.userId)
                                        } else if (e.key === 'Escape') {
                                          const originalValue = member.monthlySalary?.toString() || '0'
                                          setSalaryValues(prev => ({
                                            ...prev,
                                            [member.userId]: originalValue
                                          }))
                                          setEditingSalaryUserId(null)
                                        }
                                      }}
                                      className="h-8 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleSaveSalary(member.userId)}
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors flex-1"
                                    onClick={() => {
                                      setEditingSalaryUserId(member.userId)
                                      setSalaryValues(prev => ({
                                        ...prev,
                                        [member.userId]: member.monthlySalary?.toString() || '0'
                                      }))
                                    }}
                                  >
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                      ${(member.monthlySalary || 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}/mo
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Expenses Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Project Expenses</h3>
                {expensesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">Loading expenses...</p>
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">No expenses yet. Add your first expense!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((expense) => (
                      <Card key={expense._id || expense.id} className="border-border">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{expense.name}</p>
                              <p className="text-sm text-muted-foreground">
                                <Badge variant="outline" className="mr-2">
                                  {expense.frequency === 'daily' ? 'Daily' :
                                   expense.frequency === 'weekly' ? 'Weekly' :
                                   expense.frequency === 'monthly' ? 'Monthly' :
                                   expense.frequency === 'yearly' ? 'Yearly' : 'Monthly'}
                                </Badge>
                                Created {expense.createdAt ? format(new Date(expense.createdAt), "MMM d, yyyy") : 'N/A'}
                                {expense.updatedAt && expense.updatedAt !== expense.createdAt && (
                                  <span> • Updated {format(new Date(expense.updatedAt), "MMM d, yyyy")}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-lg font-bold">
                                  ${(expense.amount || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </p>
                              </div>
                              {canManageSettings && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenExpenseModal(expense)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setDeletingExpenseId(expense._id || expense.id)
                                      setShowDeleteExpenseDialog(true)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocked Users Tab */}
        <TabsContent value="banned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blocked Users</CardTitle>
              <CardDescription>Users who have been blocked from this project</CardDescription>
            </CardHeader>
            <CardContent>
              {bannedUsersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Loading blocked users...</p>
                </div>
              ) : bannedUsers.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No blocked users</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Blocked At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bannedUsers.map((banned) => (
                      <TableRow key={banned.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{banned.email}</p>
                            <p className="text-sm text-muted-foreground">User ID: {banned.userId.slice(-8)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{banned.reason}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(banned.bannedAt), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageSettings && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnblockUser(banned.userId)}
                              disabled={unblockingUserId === banned.userId}
                            >
                              {unblockingUserId === banned.userId ? (
                                'Unblocking...'
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Unblock
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Expense Modal */}
      <ExpenseModal
        open={showExpenseModal}
        onOpenChange={handleCloseExpenseModal}
        expense={editingExpense}
        onSuccess={handleExpenseSubmit}
      />

      {/* Delete Expense Dialog */}
      <AlertDialog open={showDeleteExpenseDialog} onOpenChange={setShowDeleteExpenseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteExpenseDialog(false)
              setDeletingExpenseId(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deletingExpenseId}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
