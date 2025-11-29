"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock, ChevronDown, ChevronUp } from "lucide-react"
import { mockRoles } from "@/lib/mock-data"

const availablePermissions = [
  { id: "edit_budget", label: "Edit Budget", description: "Manage project finances and transactions" },
  { id: "manage_roles", label: "Manage Roles", description: "Create and modify user roles" },
  { id: "can_track_time", label: "Track Time", description: "Log time and view time tracking" },
  { id: "edit_tasks", label: "Edit Tasks", description: "Create and modify tasks" },
  { id: "delete_project", label: "Delete Project", description: "Permanently delete the project" },
]

export function RolesTab() {
  const [expandedRole, setExpandedRole] = useState<string | null>(mockRoles[0].id)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Discord-style hierarchical roles with granular permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockRoles
              .sort((a, b) => a.hierarchy - b.hierarchy)
              .map((role) => (
                <Card key={role.id} className="border-l-4" style={{ borderLeftColor: role.color }}>
                  <CardContent className="py-4">
                    <div className="space-y-4">
                      {/* Role Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{role.name}</h3>
                              {role.isOwner && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Owner
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Hierarchy Level {role.hierarchy}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                        >
                          {expandedRole === role.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Permissions (Expanded) */}
                      {expandedRole === role.id && (
                        <div className="space-y-3 pt-4 border-t border-border">
                          <h4 className="text-sm font-medium">Permissions</h4>
                          {availablePermissions.map((permission) => {
                            const isEnabled = role.permissions.includes(permission.id)
                            const isCritical = ["edit_budget", "manage_roles", "delete_project"].includes(permission.id)
                            const isLocked = role.isOwner && isCritical

                            return (
                              <div
                                key={permission.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  isLocked ? "bg-muted/50 border-primary/50" : "bg-card border-border"
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`${role.id}-${permission.id}`}>{permission.label}</Label>
                                    {isLocked && <Lock className="h-3 w-3 text-primary" />}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">{permission.description}</p>
                                  {isLocked && (
                                    <p className="text-xs text-primary mt-1">
                                      Critical permission: Cannot be disabled for Owner role
                                    </p>
                                  )}
                                </div>
                                <Switch
                                  id={`${role.id}-${permission.id}`}
                                  checked={isEnabled}
                                  disabled={isLocked}
                                  onCheckedChange={() => {}}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
