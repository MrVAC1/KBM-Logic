import { OnboardingModal } from "@/components/onboarding-modal"

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <OnboardingModal open={true} />
    </div>
  )
}
