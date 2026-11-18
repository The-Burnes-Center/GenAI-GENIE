import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { LegacyChatRedirect } from './layout/LegacyChatRedirect'
import { AccountGate } from './layout/AccountGate'
import { AppShell } from './layout/AppShell'
import { AdminRoute } from './auth/AdminRoute'
import { RequireAuth } from './auth/RequireAuth'
import { ChatRoute } from './pages/chat/ChatRoute'
import { ComparePage } from './pages/compare/ComparePage'
import { TemplatesPage } from './pages/TemplatesPage'
import { WorkspacesPage } from './pages/WorkspacesPage'
import { WorkspaceDetailPage } from './pages/WorkspaceDetailPage'
import { LearnPage } from './pages/learn/LearnPage'
import { HistoryPage } from './pages/HistoryPage'
import { AccountPage } from './pages/account/AccountPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ForgotPage } from './pages/auth/ForgotPage'
import { SignInPage } from './pages/auth/SignInPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { PendingPage, SuspendedPage } from './pages/auth/StatusPages'
import { PageFrame } from './layout/PageFrame'
import { RootLayout } from './layout/RootLayout'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminModelsPage } from './pages/admin/AdminModelsPage'
import { AdminTemplatesPage } from './pages/admin/AdminTemplatesPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminUsagePage } from './pages/admin/AdminUsagePage'
import { AdminFeedbackPage } from './pages/admin/AdminFeedbackPage'
import { AdminAuditPage } from './pages/admin/AdminAuditPage'
import { AdminTemplateEditorPage } from './pages/admin/AdminTemplateEditorPage'

const framed = (page: ReactElement) => <PageFrame>{page}</PageFrame>

const ADMIN_ROUTES = [
  { index: true, element: <Navigate to="users" replace /> },
  { path: 'users', element: framed(<AdminUsersPage />) },
  { path: 'models', element: framed(<AdminModelsPage />) },
  { path: 'templates', element: framed(<AdminTemplatesPage />) },
  { path: 'templates/new', element: framed(<AdminTemplateEditorPage />) },
  { path: 'templates/:id', element: framed(<AdminTemplateEditorPage />) },
  { path: 'settings', element: framed(<AdminSettingsPage />) },
  { path: 'usage', element: framed(<AdminUsagePage />) },
  { path: 'feedback', element: framed(<AdminFeedbackPage />) },
  { path: 'audit', element: framed(<AdminAuditPage />) },
]

// Public routes first. Everything else needs a signed-in user whose profile is active.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/signin', element: <SignInPage /> },
      { path: '/login', element: <Navigate to="/signin" replace /> },
      { path: '/signup', element: <SignUpPage /> },
      { path: '/forgot', element: <ForgotPage /> },
      { path: '/pending', element: <PendingPage /> },
      { path: '/suspended', element: <SuspendedPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AccountGate />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/home" replace /> },
                  { path: 'home', element: <ChatRoute /> },
                  { path: 'chat/:sessionId', element: <ChatRoute /> },
                  { path: 'c/:sessionId', element: <LegacyChatRedirect /> },
                  { path: 'compare', element: <ComparePage /> },
                  { path: 'compare/:sessionId', element: <ComparePage /> },
                  { path: 'templates', element: framed(<TemplatesPage />) },
                  { path: 'learn', element: <LearnPage /> },
                  { path: 'workspaces', element: framed(<WorkspacesPage />) },
                  { path: 'workspaces/:id', element: framed(<WorkspaceDetailPage />) },
                  { path: 'history', element: framed(<HistoryPage />) },
                  { path: 'account', element: <AccountPage /> },
                  { path: 'admin', element: <AdminRoute />, children: ADMIN_ROUTES },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
