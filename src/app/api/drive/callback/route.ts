/**
 * GET /api/drive/callback
 * Recibe el code de OAuth2 de Google y guarda el token.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, saveToken } from "@/lib/drive-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/configuracion-drive?error=oauth_denied", req.url));
  }

  try {
    const oauth2 = getOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    saveToken(tokens);
    return NextResponse.redirect(new URL("/configuracion-drive?connected=1", req.url));
  } catch (err: any) {
    console.error("Drive OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/configuracion-drive?error=${encodeURIComponent(err.message)}`, req.url)
    );
  }
}
