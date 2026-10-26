import { Outlet } from 'react-router-dom'
import { NavigationRail } from './NavigationRail'

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas-light dark:bg-canvas-dark text-ink-primary dark:text-ink-primary-dark select-none">
      {/* 1. Global Navigation Rail (64px) bên trái */}
      <NavigationRail />

      {/* 2. Vùng hiển thị nội dung chính (Sidebar + Chat Canvas) */}
      <main className="flex-1 flex min-w-0 h-full overflow-hidden bg-surface-light dark:bg-surface-dark">
        <Outlet />
      </main>
    </div>
  )
}
