import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/authorization";

export async function requireAdminApi() {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return {
      admin: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }
  return { admin, response: null };
}
