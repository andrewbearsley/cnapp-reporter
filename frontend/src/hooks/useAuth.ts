import { createContext, useContext } from 'react'

interface AuthContextType {
  token: string | null
  setToken: (token: string | null) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
