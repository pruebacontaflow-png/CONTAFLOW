import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: "admin" | "contador" | "proveedor";
      proveedor_id?: number | null;
    };
  }

  interface User {
    id: string;
    name: string;
    email?: string | null;
    role: "admin" | "contador" | "proveedor";
    proveedor_id?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "contador" | "proveedor";
    proveedor_id?: number | null;
    userId: string;
  }
}
