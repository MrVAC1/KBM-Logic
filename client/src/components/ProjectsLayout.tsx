import { Outlet } from "react-router-dom"

export default function ProjectsLayout() {
  return (
    <div className="min-h-screen">
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  )
}

