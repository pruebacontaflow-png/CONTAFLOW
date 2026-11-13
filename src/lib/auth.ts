import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          // Buscar usuario en la base de datos
          const user = await db.get(
            `SELECT * FROM usuarios WHERE username = ? AND activo = 1`,
            [credentials.username]
          );

          if (!user) return null;

          // Verificar contraseña con bcrypt
          const passwordValid = await bcrypt.compare(
            credentials.password,
            String(user.password_hash)
          );

          if (!passwordValid) return null;

          return {
            id: String(user.id),
            name: String(user.username),
            email: `${user.username}@contaflow.local`,
            role: user.rol as "admin" | "contador" | "proveedor",
            proveedor_id: user.proveedor_id ? Number(user.proveedor_id) : null,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.proveedor_id = (user as any).proveedor_id ?? null;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).proveedor_id = token.proveedor_id ?? null;
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },

  secret: process.env.NEXTAUTH_SECRET,
};
