import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'

describe('ProtectedRoute Gate Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: true,
      isLoading: false,
    })
  })

  it('renders SplashScreen and does not redirect when app is still initializing', () => {
    useAuthStore.setState({ isInitializing: true, isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div>Chat Canvas Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Should display the branded loading message from SplashScreen
    expect(screen.getByText('Đang xác thực phiên làm việc ReChat...')).toBeInTheDocument()
    expect(screen.queryByText('Chat Canvas Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument()
  })

  it('redirects to /login when isInitializing is false and user is not authenticated', () => {
    useAuthStore.setState({ isInitializing: false, isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div>Chat Canvas Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument()
    expect(screen.queryByText('Chat Canvas Protected Content')).not.toBeInTheDocument()
  })

  it('renders protected children when isInitializing is false and user is authenticated', () => {
    useAuthStore.setState({
      isInitializing: false,
      isAuthenticated: true,
      token: 'valid-in-memory-token',
    })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div>Chat Canvas Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Chat Canvas Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument()
  })
})
