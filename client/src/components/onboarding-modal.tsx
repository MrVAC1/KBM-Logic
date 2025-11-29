import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, MapPin } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface OnboardingModalProps {
  open: boolean
}

const cities = [
  "San Francisco, CA",
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Austin, TX",
  "Seattle, WA",
  "Boston, MA",
  "Denver, CO",
]

export function OnboardingModal({ open }: OnboardingModalProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState("")
  const [birthDate, setBirthDate] = useState<Date>()
  const [location, setLocation] = useState("")
  const [locationSearch, setLocationSearch] = useState("")
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [bio, setBio] = useState("")

  const filteredCities = cities.filter((city) => city.toLowerCase().includes(locationSearch.toLowerCase()))

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleComplete = () => {
    // TODO: Save user data to backend
    // await api.put('/users/me', { nickname, birthDate, location, bio })
    navigate("/projects")
  }

  const progress = (step / 3) * 100

  return (
    <Dialog open={open} modal>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Complete Your Profile</DialogTitle>
          <DialogDescription>We need a few details to get you started</DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2" />

        <div className="space-y-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-24 w-24 border-2 border-primary">
                  <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                    {nickname.slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname *</Label>
                <Input
                  id="nickname"
                  placeholder="Enter your nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Birth Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !birthDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {birthDate ? format(birthDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar selected={birthDate} onSelect={setBirthDate} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Search for your city"
                    value={locationSearch}
                    onChange={(e) => {
                      setLocationSearch(e.target.value)
                      setShowLocationDropdown(true)
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    className="pl-9"
                  />
                  {showLocationDropdown && filteredCities.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                      {filteredCities.map((city) => (
                        <button
                          key={city}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setLocation(city)
                            setLocationSearch(city)
                            setShowLocationDropdown(false)
                          }}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {location && (
                  <p className="text-sm text-muted-foreground">
                    Selected: <span className="text-foreground">{location}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-medium">Profile Summary</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Nickname:</span> {nickname}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Birth Date:</span>{" "}
                    {birthDate ? format(birthDate, "PPP") : "Not set"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Location:</span> {location || "Not set"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={(step === 1 && (!nickname || !birthDate)) || (step === 2 && !location)}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleComplete}>Complete Setup</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
