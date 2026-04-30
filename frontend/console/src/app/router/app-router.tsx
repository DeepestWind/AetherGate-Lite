import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AppShell } from '@/app/shell/app-shell'
import { ChatPage } from '@/features/chat/pages/chat-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { EndpointsPage } from '@/features/endpoints/pages/endpoints-page'
import { PromptsPage } from '@/features/prompts/pages/prompts-page'
import { NotFoundPage } from '@/shared/pages/not-found-page'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'endpoints',
        element: <EndpointsPage />
      },
      {
        path: 'prompts',
        element: <PromptsPage />
      },
      {
        path: 'chat',
        element: <ChatPage />
      }
    ]
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
