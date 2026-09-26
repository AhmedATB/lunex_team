import { generateKeyPairSync, createVerify } from "node:crypto";
import { DriveError, folderIdFromLink, GoogleDriveClient, loadDriveCredentials, naturalCompare } from "./google-drive.client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const KEY_FILE = JSON.stringify({ type: "service_account", client_email: "reader@project.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.example/token" });

describe("folderIdFromLink", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  it.each([
    [`https://drive.google.com/drive/folders/${id}`, id],
    [`https://drive.google.com/drive/folders/${id}?usp=sharing`, id],
    [`https://drive.google.com/drive/u/0/folders/${id}`, id],
    [`https://drive.google.com/open?id=${id}`, id],
    [id, id],
    [`  ${id}  `, id],
  ])("finds the folder in %s", (link, expected) => expect(folderIdFromLink(link)).toBe(expected));

  it("refuses anything that is not a folder link", () => {
    expect(folderIdFromLink("https://example.com/x")).toBeNull();
    expect(folderIdFromLink("short")).toBeNull();
    expect(folderIdFromLink("")).toBeNull();
  });
});

describe("naturalCompare", () => {
  it("puts page 2 before page 10 whatever the zeros and the case", () => {
    const names = ["10.jpg", "2.jpg", "001.jpg", "Page_03.PNG", "page_1.png", "20.jpg"];
    expect([...names].sort(naturalCompare)).toEqual(["001.jpg", "2.jpg", "Page_03.PNG", "10.jpg", "20.jpg", "page_1.png"].sort(naturalCompare));
    expect(["10.jpg", "9.jpg", "1.jpg"].sort(naturalCompare)).toEqual(["1.jpg", "9.jpg", "10.jpg"]);
  });
});

describe("loadDriveCredentials", () => {
  const never = () => {
    throw new Error("no file");
  };

  it("reads the key from the variable, plain or base64, or from a file", () => {
    expect(loadDriveCredentials({ json: KEY_FILE }, never)?.client_email).toBe("reader@project.iam.gserviceaccount.com");
    expect(loadDriveCredentials({ json: Buffer.from(KEY_FILE).toString("base64") }, never)?.client_email).toBe("reader@project.iam.gserviceaccount.com");
    expect(loadDriveCredentials({ file: "/keys/drive.json" }, () => KEY_FILE)?.token_uri).toBe("https://oauth2.example/token");
  });

  it("repairs a private key whose line breaks arrived as the characters backslash-n", () => {
    const flattened = JSON.stringify({ client_email: "a@b", private_key: privateKey.replace(/\n/g, "\\n") }).replace(/\\\\n/g, "\\n");
    const parsed = loadDriveCredentials({ json: flattened }, never);
    expect(parsed?.private_key).toContain("\n");
    expect(parsed?.private_key.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
  });

  it("says nothing is set up when there is no usable key", () => {
    expect(loadDriveCredentials({}, never)).toBeNull();
    expect(loadDriveCredentials({ json: "not json at all" }, never)).toBeNull();
    expect(loadDriveCredentials({ json: JSON.stringify({ client_email: "a@b" }) }, never)).toBeNull();
    expect(loadDriveCredentials({ file: "/missing.json" }, never)).toBeNull();
  });
});

function fakeGoogle(handler: (url: URL, init?: RequestInit) => { status: number; body?: unknown; bytes?: Buffer }) {
  const calls: { url: string; auth?: string }[] = [];
  const http = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: `${url.pathname}${url.search}`, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
    const { status, body, bytes } = handler(url, init);
    return new Response(bytes ? new Uint8Array(bytes) : JSON.stringify(body ?? {}), { status });
  }) as unknown as typeof fetch;
  return { http, calls };
}

const credentials = { client_email: "reader@project.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.example/token" };

describe("GoogleDriveClient", () => {
  it("signs a token request with the service account's key and reuses the token", async () => {
    let assertion = "";
    const { http, calls } = fakeGoogle((url, init) => {
      if (url.origin === "https://oauth2.example") {
        assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
        return { status: 200, body: { access_token: "tok", expires_in: 3600 } };
      }
      return { status: 200, body: { mimeType: "application/vnd.google-apps.folder" } };
    });
    const client = new GoogleDriveClient(credentials, http);
    await client.assertFolder("folder-id-1234567890");
    await client.assertFolder("folder-id-1234567890");

    const [header, claims, signature] = assertion.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: credentials.token_uri });
    expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(calls.filter((c) => c.url.startsWith("/token")).length).toBe(1);
    expect(calls.filter((c) => c.auth === "Bearer tok").length).toBe(2);
  });

  it("lists a folder's images in reading order, across pages of results", async () => {
    const { http } = fakeGoogle((url) => {
      if (url.origin === "https://oauth2.example") return { status: 200, body: { access_token: "tok" } };
      if (url.searchParams.get("pageToken") === "next") return { status: 200, body: { files: [{ id: "c", name: "10.jpg", mimeType: "image/jpeg" }] } };
      return { status: 200, body: { files: [{ id: "b", name: "2.jpg", mimeType: "image/jpeg" }, { id: "a", name: "1.jpg", mimeType: "image/jpeg" }], nextPageToken: "next" } };
    });
    const images = await new GoogleDriveClient(credentials, http).listImages("folder-id-1234567890");
    expect(images.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("tells a private folder (not found) from a file and from a working folder", async () => {
    const answers: Record<string, { status: number; body?: unknown }> = {
      private: { status: 404 },
      file: { status: 200, body: { mimeType: "image/png" } },
      ok: { status: 200, body: { mimeType: "application/vnd.google-apps.folder" } },
    };
    const { http } = fakeGoogle((url) => (url.origin === "https://oauth2.example" ? { status: 200, body: { access_token: "t" } } : answers[url.pathname.split("/").pop() ?? ""]));
    const client = new GoogleDriveClient(credentials, http);
    await expect(client.assertFolder("private")).rejects.toMatchObject({ kind: "not_shared" });
    await expect(client.assertFolder("file")).rejects.toMatchObject({ kind: "not_a_folder" });
    await expect(client.assertFolder("ok")).resolves.toBeUndefined();
  });

  it("downloads a file's bytes and reports a refusal from Google", async () => {
    const { http } = fakeGoogle((url) => {
      if (url.origin === "https://oauth2.example") return { status: 200, body: { access_token: "t" } };
      return url.pathname.endsWith("/good") ? { status: 200, bytes: Buffer.from([1, 2, 3]) } : { status: 500 };
    });
    const client = new GoogleDriveClient(credentials, http);
    expect([...(await client.download("good"))]).toEqual([1, 2, 3]);
    await expect(client.download("bad")).rejects.toBeInstanceOf(DriveError);
  });

  it("reports a rejected service account key", async () => {
    const { http } = fakeGoogle(() => ({ status: 400 }));
    await expect(new GoogleDriveClient(credentials, http).assertFolder("x")).rejects.toMatchObject({ kind: "auth_failed" });
  });
});
