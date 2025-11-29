"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Trash2 } from "lucide-react"
import { mockDepartments, mockUsers, mockCurrentUser } from "@/lib/mock-data"

export function TeamsTab() {
  const [newDeptName, setNewDeptName] = useState("")
  const isOwner = mockCurrentUser.permissions.includes("manage_roles")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teams & Departments</CardTitle>
          <CardDescription>Create and manage organizational groups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Array.isArray(mockDepartments) ? mockDepartments : []).map((dept) => {
            const deptMembers = Array.isArray(dept?.members) ? dept.members : []
            const members = mockUsers.filter((u) => deptMembers.includes(u.id))

            return (
              <Card key={dept.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">{dept.name}</h3>
                        <Badge variant="secondary">{members.length} members</Badge>
                      </div>

                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.nickname} />
                                <AvatarFallback>{member.nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.nickname}</p>
                                <p className="text-sm text-muted-foreground">{member.role || "No role"}</p>
                              </div>
                            </div>
                            {isOwner && member.salary && (
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Salary</p>
                                <p className="font-semibold">${member.salary.toLocaleString()}/yr</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {isOwner && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive ml-4">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {isOwner && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Label htmlFor="new-dept">Create New Department</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-dept"
                      placeholder="e.g., Marketing"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                    />
                    <Button onClick={() => setNewDeptName("")} disabled={!newDeptName}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
