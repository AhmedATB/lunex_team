import { createSign } from "node:crypto";

/** What the site needs from a Google service-account key file. */
export interface DriveCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
}

/** Why a folder could not be read: it is not shared with the service account, or it is not a folder, or Google refused. */
export class DriveError extends Error {
  constructor(
    readonly kind: "not_shared" | "not_a_folder" | "auth_failed" | "rate_limited" | "failed",
    message: string
  ) {
    super(message);
  }
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

/**
 * Reads the service account's key from the environment: `GOOGLE_DRIVE_CREDENTIALS_JSON` (the key file's content, as is or
 * base64-encoded — what a hosting dashboard takes) or `GOOGLE_DRIVE_CREDENTIALS_FILE` (a path, for a developer's machine).
 * Returns null when neither is set or the key is not usable, so the feature simply reports itself as not set up.
 */
export function loadDriveCredentials(source: { json?: string | undefined; file?: string | undefined }, readFile: (path: string) => string): DriveCredentials | null {
  let text = source.json?.trim();
  if (!text && source.file) {
    try {
      text = readFile(source.file);
    } catch {
      return null;
    }
  }
  if (!text) return null;
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text) as Partial<DriveCredentials>;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    return {
      client_email: parsed.client_email,
      // A key pasted into a dashboard often carries its line breaks as the two characters "\n".
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
      token_uri: typeof parsed.token_uri === "string" ? parsed.token_uri : DEFAULT_TOKEN_URI,
    };
  } catch {
    return null;
  }
}

/** The folder's id from whatever a person pastes: a folder link (`/folders/<id>`), a share link (`?id=<id>`), or the bare id. */
export function folderIdFromLink(link: string): string | null {
  const text = link.trim();
  const fromPath = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(text)?.[1];
  if (fromPath) return fromPath;
  const fromQuery = /[?&]id=([A-Za-z0-9_-]{10,})/.exec(text)?.[1];
  if (fromQuery) return fromQuery;
  return /^[A-Za-z0-9_-]{20,}$/.test(text) ? text : null;
}

/** File names in reading order: 2 before 10, whatever the case and whatever number of leading zeros. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const base64Url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * A minimal Google Drive reader for a service account: sign a short-lived token request with the account's key, ask for
 * read-only access, list a folder's images and download them. No client library: it is a handful of HTTPS calls.
 */
export class GoogleDriveClient {
  private cached: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: DriveCredentials,
    private readonly http: typeof fetch = fetch
  ) {}

  /** The address people must share a private folder with. */
  get serviceEmail(): string {
    return this.credentials.client_email;
  }

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expiresAt - 60 > now) return this.cached.value;

    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64Url(
      JSON.stringify({ iss: this.credentials.client_email, scope: SCOPE, aud: this.credentials.token_uri, iat: now, exp: now + 3600 })
    );
    const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(this.credentials.private_key);
    const assertion = `${header}.${claims}.${base64Url(signature)}`;

    const res = await this.http(this.credentials.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!res.ok) throw new DriveError("auth_failed", `Google refused the service account (${res.status}).`);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new DriveError("auth_failed", "Google returned no access token.");
    this.cached = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
    return body.access_token;
  }

  private async get(path: string, params: Record<string, string>): Promise<Response> {
    const token = await this.accessToken();
    const url = `${DRIVE_API}${path}?${new URLSearchParams({ supportsAllDrives: "true", ...params })}`;
    const res = await this.http(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) throw new DriveError("rate_limited", "Google Drive is limiting requests; try again in a minute.");
    return res;
  }

  /**
   * Checks the folder can be read. Google answers "not found" for a folder that exists but was not shared with the account
   * (and lists it as empty), so this is asked first: an empty result would otherwise look like an empty folder.
   */
  async assertFolder(folderId: string): Promise<void> {
    const res = await this.get(`/files/${encodeURIComponent(folderId)}`, { fields: "id,mimeType" });
    if (res.status === 404 || res.status === 403) {
      throw new DriveError("not_shared", "The folder is private and not shared with the service account, or it does not exist.");
    }
    if (!res.ok) throw new DriveError("failed", `Drive answered ${res.status}.`);
    const file = (await res.json()) as { mimeType?: string };
    if (file.mimeType !== FOLDER_MIME) throw new DriveError("not_a_folder", "This link is a file, not a folder.");
  }

  /** The folder's images in reading order. */
  async listImages(folderId: string): Promise<DriveImage[]> {
    const images: DriveImage[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.get("/files", {
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: "nextPageToken,files(id,name,mimeType)",
        pageSize: "1000",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      if (!res.ok) throw new DriveError("failed", `Drive answered ${res.status}.`);
      const body = (await res.json()) as { files?: DriveImage[]; nextPageToken?: string };
      images.push(...(body.files ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return images.sort((a, b) => naturalCompare(a.name, b.name));
  }

  async download(fileId: string): Promise<Buffer> {
    const res = await this.get(`/files/${encodeURIComponent(fileId)}`, { alt: "media" });
    if (!res.ok) throw new DriveError("failed", `Could not download a file (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
}
