import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { product, email, phone, name } = await req.json();

    if (!product || (!email && !phone)) {
      return NextResponse.json({ error: "Product and either Email or Phone are required" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const signupIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const { error } = await supabase.from("product_waitlist").insert({
      product,
      email,
      phone,
      name,
      signup_ip: signupIp,
    });

    if (error) {
      console.error("Waitlist DB Error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Waitlist API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
