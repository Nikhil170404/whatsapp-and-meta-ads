import { NextResponse } from "next/server";
import type { OpResult } from "@/lib/api/ops";

/** Turns an operation result into a JSON response; `shape` adapts the success body. */
export function respond<T>(result: OpResult<T>, shape?: (data: T) => unknown, okStatus = 200) {
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}), ...(result.issues ? { issues: result.issues } : {}) },
      { status: result.status }
    );
  }
  return NextResponse.json(shape ? shape(result.data) : result.data, { status: okStatus });
}
