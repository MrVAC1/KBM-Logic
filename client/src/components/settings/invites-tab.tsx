"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Copy, RefreshCw, Mail, Check } from "lucide-react"

export function InvitesTab() {
  const [inviteLink, setInviteLink] = useState("https://kbm-logic.app/join/abc123xyz")
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    setIsRegenerating(true)
    setTimeout(() => {
      setInviteLink(`https://kbm-logic.app/join/${Math.random().toString(36).substring(7)}`)
      setIsRegenerating(false)
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Links</CardTitle>
          <CardDescription>Generate and manage invitation links for new team members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-link">Current Invite Link</Label>
              <div className="flex gap-2 mt-2">
                <Input id="invite-link" value={inviteLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">How Invites Work</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Share this link with team members to join the project</li>
                    <li>• Links remain valid until regenerated</li>
                    <li>• New members will need to enter the project password</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <h4 className="font-medium mb-1">Regenerate Link</h4>
                <p className="text-sm text-muted-foreground">
                  This will invalidate the current link and create a new one
                </p>
              </div>
              <Button variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Recent Invitations</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">alex@example.com</p>
                  <p className="text-sm text-muted-foreground">Invited 2 days ago</p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success">
                  Accepted
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">maria@example.com</p>
                  <p className="text-sm text-muted-foreground">Invited 5 days ago</p>
                </div>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                  Pending
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
