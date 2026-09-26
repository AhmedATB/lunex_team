/**
 * Reads a ZIP file in the browser, without uploading it: the list of its files, and the bytes of any one of them on
 * demand. Only the parts that are needed are read from the file (the end of it for the index, then each picture as it is
 * asked for), so a big archive does not have to fit in memory. Handles the two ways ZIP stores a file — as is, or
 * deflated — which is what every tool writes for pictures.
 */

export interface ZipEntry {
  /** The path inside the archive. */
  name: string;
  size: number;
  read: () => Promise<Uint8Array>;
}

export class ZipError extends Error {}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** The end-of-central-directory record sits in the last 22 bytes plus at most a 64 KB comment. */
const TAIL_BYTES = 22 + 0xffff;

async function bytes(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new ZipError("هذا المتصفح لا يدعم فتح ملفات ZIP. جرّب متصفحًا أحدث.");
  const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeName(raw: Uint8Array, utf8: boolean): string {
  try {
    return new TextDecoder(utf8 ? "utf-8" : "utf-8", { fatal: true }).decode(raw);
  } catch {
    return new TextDecoder("latin1").decode(raw);
  }
}

/** The files in the archive (folders left out), in the order the archive lists them. */
export async function readZip(file: Blob): Promise<ZipEntry[]> {
  if (file.size < 22) throw new ZipError("الملف ليس ملف ZIP صالحًا.");

  const tailStart = Math.max(0, file.size - TAIL_BYTES);
  const tail = await bytes(file, tailStart, file.size);
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("الملف ليس ملف ZIP صالحًا.");

  const entryCount = tailView.getUint16(eocd + 10, true);
  const directorySize = tailView.getUint32(eocd + 12, true);
  const directoryOffset = tailView.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new ZipError("هذا الملف كبير جدًا (ZIP64). قسّمه إلى أجزاء أصغر.");
  }

  const directory = await bytes(file, directoryOffset, directoryOffset + directorySize);
  const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);

  const entries: ZipEntry[] = [];
  let cursor = 0;
  for (let n = 0; n < entryCount; n++) {
    if (cursor + 46 > directory.length || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) throw new ZipError("فهرس ملف ZIP تالف.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decodeName(directory.subarray(cursor + 46, cursor + 46 + nameLength), (flags & 0x800) !== 0);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue; // a folder

    entries.push({
      name,
      size,
      read: async () => {
        const header = await bytes(file, localOffset, localOffset + 30);
        const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
        if (headerView.getUint32(0, true) !== LOCAL_SIGNATURE) throw new ZipError("ملف ZIP تالف.");
        const dataStart = localOffset + 30 + headerView.getUint16(26, true) + headerView.getUint16(28, true);
        const stored = await bytes(file, dataStart, dataStart + compressedSize);
        if (method === 0) return stored;
        if (method === 8) return inflate(stored);
        throw new ZipError("طريقة ضغط غير مدعومة في هذا الملف.");
      },
    });
  }
  return entries;
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)$/i;
const IGNORED = /(^|\/)(__MACOSX\/|\.[^/]*$|Thumbs\.db$|desktop\.ini$)/i;

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" };

/** Names in reading order: 2 before 10, whatever the case and the leading zeros. */
export const naturalCompare = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * The pictures inside a ZIP as ready-to-upload files, in reading order. Folders, hidden files and the extras that
 * macOS and Windows add are left out. `total` is how many pictures there are, `limit` a guard against a wrong archive.
 */
export async function imagesFromZip(archive: Blob, limit = 300): Promise<File[]> {
  const entries = (await readZip(archive)).filter((e) => IMAGE_EXTENSION.test(e.name) && !IGNORED.test(e.name));
  entries.sort((a, b) => naturalCompare(a.name, b.name));
  if (entries.length > limit) throw new ZipError(`في الملف ${entries.length} صورة، والحد الأقصى للفصل ${limit}.`);

  const files: File[] = [];
  for (const entry of entries) {
    const data = await entry.read();
    const base = entry.name.split("/").pop() ?? entry.name;
    const extension = base.split(".").pop()?.toLowerCase() ?? "";
    files.push(new File([data as BlobPart], base, { type: MIME[extension] ?? "application/octet-stream" }));
  }
  return files;
}
