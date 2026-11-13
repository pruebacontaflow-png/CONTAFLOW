/**
 * Google Drive service — OAuth2 + listado/descarga de PDFs.
 * Credenciales: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET en .env.local
 * Token persiste en datos/drive-token.json (no va a git).
 */
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "datos", "drive-token.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/drive/callback"
  );
}

export function getAuthUrl(): string {
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    login_hint: process.env.GOOGLE_ACCOUNT_HINT || "",
  });
}

export function tokenExists(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

export function loadToken(): any | null {
  try {
    if (!tokenExists()) return null;
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  } catch { return null; }
}

export function saveToken(token: any): void {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function deleteToken(): void {
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
}

export async function getAuthenticatedClient() {
  const token = loadToken();
  if (!token) throw new Error("No hay token de Google Drive. Conectá la cuenta primero.");
  const oauth2 = getOAuthClient();
  oauth2.setCredentials(token);
  // Auto-refresh si el token está por vencer
  oauth2.on("tokens", (newTokens) => {
    const merged = { ...token, ...newTokens };
    saveToken(merged);
  });
  return oauth2;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function listPdfFiles(folderId: string, sinceMs?: number): Promise<DriveFile[]> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth });

  let query = `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`;
  if (sinceMs) {
    const sinceDate = new Date(sinceMs).toISOString();
    query += ` and modifiedTime > '${sinceDate}'`;
  }

  const res = await drive.files.list({
    q: query,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
    pageSize: 100,
    orderBy: "modifiedTime desc",
  });

  return (res.data.files || []) as DriveFile[];
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function listFolders(parentId?: string): Promise<{ id: string; name: string }[]> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: "v3", auth });

  const parent = parentId || "root";
  const res = await drive.files.list({
    q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 50,
    orderBy: "name",
  });
  return (res.data.files || []).map(f => ({ id: String(f.id), name: String(f.name) }));
}
