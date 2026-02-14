import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login.jsx'
import HomePage from './HomePage.jsx'
import TicketList from './TicketList.jsx'
import TicketCreate from './TicketCreate.jsx'
import TicketDetail from './TicketDetail.jsx'
import CsvMask from './CsvMask.jsx'
import UserManage from './UserManage.jsx'
import RepairForm from './RepairForm.jsx'
import RepairTrack from './RepairTrack.jsx'
import TrackDetail from './TrackDetail.jsx'
import ContactPage from './ContactPage.jsx'
import ServicesPage from './ServicesPage.jsx'
import AboutPage from './AboutPage.jsx'

// 未登入 → 跳轉登入頁
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>⏳ 載入中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// 管理員專屬路由
function AdminOnly({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* 公開頁面 */}
      <Route path="/home" element={<HomePage />} />
      <Route path="/repair" element={<RepairForm />} />
      <Route path="/track" element={<RepairTrack />} />
      <Route path="/track/:id" element={<TrackDetail />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* 需要登入 */}
      <Route path="/" element={<RequireAuth><TicketList /></RequireAuth>} />
      <Route path="/tickets/:id" element={<RequireAuth><TicketDetail /></RequireAuth>} />

      {/* 管理員專用 */}
      <Route path="/create" element={<RequireAuth><AdminOnly><TicketCreate /></AdminOnly></RequireAuth>} />
      <Route path="/csv" element={<RequireAuth><AdminOnly><CsvMask /></AdminOnly></RequireAuth>} />
      <Route path="/users" element={<RequireAuth><AdminOnly><UserManage /></AdminOnly></RequireAuth>} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
