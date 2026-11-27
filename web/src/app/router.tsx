import { createBrowserRouter, Navigate } from 'react-router'
import { t } from '../i18n/index.ts'
import { ExercisesPage } from '../pages/exercises/ExercisesPage.tsx'
import { SessionPage } from '../pages/exercises/SessionPage.tsx'
import { CheatSheetPage } from '../pages/cheatsheet/CheatSheetPage.tsx'
import { LessonPage } from '../pages/lessons/LessonPage.tsx'
import { LessonsPage } from '../pages/lessons/LessonsPage.tsx'
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx'
import { AppLayout } from './AppLayout.tsx'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/lessons" replace /> },
      { path: 'lessons', element: <LessonsPage /> },
      { path: 'lessons/:slug', element: <LessonPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'exercises/repeat', element: <SessionPage /> },
      { path: 'exercises/:lesson', element: <SessionPage /> },
      { path: 'cheatsheet', element: <CheatSheetPage /> },
      { path: 'mistakes', element: <PlaceholderPage title={t.nav.mistakes} note={t.placeholder.mistakes} /> },
      { path: '*', element: <PlaceholderPage title={t.notFound.title} note={t.notFound.note} /> },
    ],
  },
])
