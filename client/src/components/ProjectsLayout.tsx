import { Outlet } from "react-router-dom"
import { AppSidebar } from "./app-sidebar"

export default function ProjectsLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

