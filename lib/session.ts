import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  adminId?: number;
  companyId?: number;
  email?: string;
}

const password =
  process.env.SESSION_SECRET ||
  "segredo-de-desenvolvimento-troque-em-producao-1234567890";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "ponto_admin_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** Retorna a sessão se houver admin autenticado, senão null. */
export async function getAuthenticatedAdmin(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.adminId || !session.companyId) return null;
  return {
    adminId: session.adminId,
    companyId: session.companyId,
    email: session.email,
  };
}
