import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Chrome } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/config/firebase"

export default function LoginPage() {
  // CRITICAL: All hooks must be declared at the top, before any conditional returns
  const navigate = useNavigate()
  const { user, loading, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth()
  
  // All useState hooks must be declared before any early returns
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/projects", { replace: true })
    }
  }, [user, loading, navigate])

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render login form if user is already logged in (redirect will happen)
  if (user) {
    return null
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await loginWithGoogle()
      if (result.success) {
        // Wait a moment for auth state to update
        await new Promise(resolve => setTimeout(resolve, 100))
        // Navigate to projects - auth state should be updated by now
        navigate("/projects", { replace: true })
      } else {
        toast.error(result.error || "Google sign in failed")
      }
    } catch (error) {
      toast.error("An error occurred during sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await loginWithEmail(email, password)
      if (result.success) {
        // Wait a moment for auth state to update
        await new Promise(resolve => setTimeout(resolve, 100))
        // Navigate to projects - auth state should be updated by now
        navigate("/projects", { replace: true })
      } else {
        // Check for rate limiting
        if (result.error?.includes('too-many-requests') || result.error?.includes('429')) {
          toast.error("Too many login attempts. Please wait a moment and try again.", {
            duration: 5000,
          })
        } else {
          toast.error(result.error || "Sign in failed")
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests' || error?.response?.status === 429) {
        toast.error("Too many login attempts. Please wait a few minutes and try again.", {
          duration: 5000,
        })
      } else {
        toast.error("An error occurred during sign in")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    try {
      const result = await registerWithEmail(email, password, displayName)
      if (result.success) {
        // Firebase automatically signs in the user after registration
        // Wait a moment for the auth state to update
        await new Promise(resolve => setTimeout(resolve, 100))
        
        toast.success("Account created successfully! You are now logged in.")
        
        // Wait a moment for auth state to update
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Navigate to projects - user is automatically logged in
        navigate("/projects", { replace: true })
      } else {
        // Check for rate limiting
        if (result.error?.includes('too-many-requests') || result.error?.includes('429')) {
          toast.error("Too many registration attempts. Please wait a moment and try again.", {
            duration: 5000,
          })
        } else {
          toast.error(result.error || "Registration failed")
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests' || error?.response?.status === 429) {
        toast.error("Too many registration attempts. Please wait a few minutes and try again.", {
          duration: 5000,
        })
      } else {
        toast.error("An error occurred during registration")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!resetEmail || !emailRegex.test(resetEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      toast.success("Password reset email sent! Please check your inbox.", {
        duration: 5000,
      })
      setShowResetModal(false)
      setResetEmail("")
    } catch (error: any) {
      let errorMessage = "Failed to send reset email. Please try again."
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address."
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please wait a moment and try again."
      }
      
      toast.error(errorMessage, {
        duration: 5000,
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">KBM</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Create an Account" : "Welcome to KBM Logic"}
          </CardTitle>
          <CardDescription>
            {isSignUp ? "Sign up to start managing your projects" : "Sign in to manage your projects"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSignUp ? (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Sign up"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(true)
                    setResetEmail(email) // Pre-fill with current email if available
                  }}
                  className="text-sm text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
            <Chrome className="mr-2 h-5 w-5" />
            {isSignUp ? "Sign up with Google" : "Sign in with Google"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button 
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setIsSignUp(false)
                    setEmail("")
                    setPassword("")
                    setConfirmPassword("")
                    setDisplayName("")
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button 
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setIsSignUp(true)
                    setEmail("")
                    setPassword("")
                    setConfirmPassword("")
                    setDisplayName("")
                  }}
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Reset Password Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResetModal(false)
                  setResetEmail("")
                }}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isResetting || !resetEmail}>
                {isResetting ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
