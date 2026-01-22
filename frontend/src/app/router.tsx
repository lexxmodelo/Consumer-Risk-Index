import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './App'
import Dashboard from '../features/dashboard/components/Dashboard'
import RiskTimelinePage from '../features/timeline/components/RiskTimelinePage'
import PerformanceDashboard from '../features/admin/components/PerformanceDashboard'
import ErrorPage from '../components/ErrorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'timeline', element: <RiskTimelinePage /> },
      { path: 'admin/performance', element: <PerformanceDashboard /> },
    ],
  },
])

export default router
