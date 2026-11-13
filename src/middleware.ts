import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    // Roles válidos: admin y contador (el rol proveedor fue eliminado en Bloque B)
    if (role && role !== "admin" && role !== "contador") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Contador no puede acceder a rutas de solo admin
    // (el frontend también lo controla con isAdmin)

    // Si alguien llega a /portal-proveedor → redirigir al dashboard
    if (path.startsWith("/portal-proveedor")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|api/ingesta).*)",
  ],
};
