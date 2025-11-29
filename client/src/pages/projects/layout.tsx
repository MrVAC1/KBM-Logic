import type React from "react"

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <main className="w-full">{children}</main>
    </div>
  )
}
