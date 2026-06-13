import { createContext, useContext, useState, ReactNode } from "react";

// User data type
interface User {
  createdAt: string;
  email: string;
  isVerified: boolean;
  lastLogin: string;
  name: string;
  role?: string;
  updatedAt: string;
  verificationToken: string;
  verificationTkoenExpiresAt: string;
  __v: number;
  _id: string;
}

interface UserData {
  message: string;
  success: true;
  user: User;
}

// Parse role from JWT cookie as fallback (cookie is not httpOnly)
function getRoleFromJwt(): string | null {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith("token="));
    if (!raw) return null;
    const payload = JSON.parse(atob(raw.split("=")[1].split(".")[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

// Context type definition
interface AuthContextType {
  user: UserData | null;
  login: (userData: UserData) => void;
  logout: () => void;
  getUser: () => UserData | null;
  getRole: () => string | null;
  isAdmin: () => boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider context
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? (JSON.parse(savedUser) as UserData) : null;
  });

  const login = (userData: UserData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const getUser = () => user;

  const getRole = (): string | null =>
    user?.user?.role ?? getRoleFromJwt();

  const isAdmin = (): boolean => getRole() === "admin";

  return (
    <AuthContext.Provider value={{ user, login, logout, getUser, getRole, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to get the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
