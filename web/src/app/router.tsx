import { createBrowserRouter, Navigate } from 'react-router'
import { t } from '../i18n/index.ts'
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx'
import { AppLayout } from './AppLayout.tsx'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/lessons" replace /> },
      { path: 'lessons', element: <PlaceholderPage title={t.nav.lessons} note={t.placeholder.lessons} /> },
      { path: 'exercises', element: <PlaceholderPage title={t.nav.exercises} note={t.placeholder.exercises} /> },
      { path: 'cheatsheet', element: <PlaceholderPage title={t.nav.cheatsheet} note={t.placeholder.cheatsheet} /> },
      { path: 'mistakes', element: <PlaceholderPage title={t.nav.mistakes} note={t.placeholder.mistakes} /> },
      { path: '*', element: <PlaceholderPage title={t.notFound.title} note={t.notFound.note} /> },
    ],
  },
])
