'use client'

import { ReactNode, useCallback, useMemo } from 'react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in your .env file')
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)

function useConvexAuth() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth()

  const getTokenWithFreshClaims = useCallback(
    async (options?: Parameters<typeof getToken>[0]) =>
      getToken({ ...options, skipCache: true }),
    [getToken]
  )

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      getToken: getTokenWithFreshClaims,
      orgId,
      orgRole,
    }),
    [getTokenWithFreshClaims, isLoaded, isSignedIn, orgId, orgRole]
  )
}

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useConvexAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
