"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ChangePasswordRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the unified onboarding experience
    router.replace("/onboarding")
  }, [router])

  return null
}
