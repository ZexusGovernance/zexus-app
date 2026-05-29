import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isSuperAdmin } from '@/lib/auth'

// GET /api/admin/check — reports whether the signed-in wallet is super-admin.
export async function GET(req: NextRequest) {
  return NextResponse.json({ isAdmin: isSuperAdmin(requireAuth(req)) })
}
