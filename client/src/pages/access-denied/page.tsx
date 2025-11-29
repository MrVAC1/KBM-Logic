import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Clock, ArrowLeft, Home } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

interface AccessDeniedPageProps {
  variant?: 'pending' | 'denied';
}

export default function AccessDeniedPage({ variant = 'pending' }: AccessDeniedPageProps) {
  const navigate = useNavigate();
  const { currentProject, getUserRole, hasAnyAccess } = useProject();

  const isPending = variant === 'pending' || !hasAnyAccess();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isPending ? 'bg-warning/10' : 'bg-destructive/10'
          }`}>
            {isPending ? (
              <Clock className="h-8 w-8 text-warning" />
            ) : (
              <ShieldAlert className="h-8 w-8 text-destructive" />
            )}
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">
              {isPending ? 'Access Pending' : 'Access Denied'}
            </CardTitle>
            <CardDescription className="text-base">
              {isPending 
                ? "You've joined the project, but you don't have permission to view this page yet."
                : "You don't have the required permissions to access this resource."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project info */}
          {currentProject && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Project</span>
                <span className="font-medium">{currentProject.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="secondary">{getUserRole()}</Badge>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">What to do next:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                <span>Contact your Project Manager or Owner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                <span>Ask them to assign you a role with appropriate permissions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                <span>Once updated, refresh this page to access the content</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => navigate('/projects')}
            >
              <Home className="mr-2 h-4 w-4" />
              My Projects
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

