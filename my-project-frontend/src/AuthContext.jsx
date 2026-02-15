import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('auth_token'))
    const [loading, setLoading] = useState(true)

    // 帶 token 的 fetch（自動偵測 FormData，不覆蓋 Content-Type）
    const authFetch = async (url, options = {}) => {
        const isFormData = options.body instanceof FormData
        const headers = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        }
        return fetch(url, { ...options, headers })
    }

    // 啟動時驗證 token
    useEffect(() => {
        if (token) {
            authFetch(`${API}/api/me`)
                .then(res => {
                    if (res.ok) return res.json()
                    throw new Error('token invalid')
                })
                .then(data => {
                    setUser(data)
                    setLoading(false)
                })
                .catch(() => {
                    localStorage.removeItem('auth_token')
                    setToken(null)
                    setUser(null)
                    setLoading(false)
                })
        } else {
            setLoading(false)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (username, password) => {
        const res = await fetch(`${API}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ username, password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || '登入失敗')

        localStorage.setItem('auth_token', data.token)
        setToken(data.token)
        setUser(data.user)
        return data.user
    }

    const logout = async () => {
        try {
            await authFetch(`${API}/api/logout`, { method: 'POST' })
        } catch (e) { /* ignore */ }
        localStorage.removeItem('auth_token')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch, API }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be within AuthProvider')
    return ctx
}
