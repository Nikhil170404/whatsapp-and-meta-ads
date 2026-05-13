import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("replykaro_session");
  return NextResponse.redirect(new URL("/signin", new URL(req.url).origin));
}
