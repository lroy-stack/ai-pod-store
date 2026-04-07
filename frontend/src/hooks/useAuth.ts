// Re-export from AuthProvider so all call sites share a single Context instance.
// The AuthProvider must be mounted in the providers tree (src/app/[locale]/providers.tsx).
export { useAuth, type AuthUser } from '@/providers/AuthProvider'
