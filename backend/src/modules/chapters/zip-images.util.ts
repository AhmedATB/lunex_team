import { unzipSync } from "fflate";
import { naturalCompare } from "./drive/google-drive.client";

export type ZipImportErrorCode = "invalid_zip" | "zip_too_large";

export class ZipImportError extends Error {
  constructor(
    readonly code: ZipImportErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface ZipImage {
  /** The path inside the archive. */
  name: string;
}

/** The picture kinds a page can be made from. */
const IMAGE_NAME = /\.(?:jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/i;
/** One picture bigger than this (unpacked) is not a page; and an archive that unpacks to more than {@link MAX_TOTAL_BYTES} is not a chapter. */
const MAX_ENTRY_BYTES = 60 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1_500 * 1024 * 1024;

/** Not pictures of the chapter: folders, the metadata macOS adds, hidden files. */
const skipped = (name: string) => name.endsWith("/") || name.startsWith("__MACOSX/") || name.split("/").some((part) => part.startsWith(".") || part === "Thumbs.db");

/**
 * The pictures inside a ZIP, in reading order (2 before 10, folders in order too). Only the archive's index is read: nothing is
 * unpacked here, so a large one is cheap to look through.
 */
export function listZipImages(zip: Uint8Array): ZipImage[] {
  const names: string[] = [];
  let total = 0;
  try {
    unzipSync(zip, {
      filter: (file) => {
        if (skipped(file.name) || !IMAGE_NAME.test(file.name)) return false;
        if (file.originalSize > MAX_ENTRY_BYTES) throw new ZipImportError("zip_too_large", `The picture ${file.name} is too large.`);
        total += file.originalSize;
        if (total > MAX_TOTAL_BYTES) throw new ZipImportError("zip_too_large", "This archive is too large to be one chapter.");
        names.push(file.name);
        return false; // only listing
      },
    });
  } catch (error) {
    if (error instanceof ZipImportError) throw error;
    throw new ZipImportError("invalid_zip", "This file is not a readable ZIP archive.");
  }
  return names.sort(naturalCompare).map((name) => ({ name }));
}

/** One picture unpacked from the archive. */
export function readZipImage(zip: Uint8Array, name: string): Buffer {
  try {
    const files = unzipSync(zip, { filter: (file) => file.name === name });
    const bytes = files[name];
    if (!bytes) throw new Error("missing");
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  } catch {
    throw new ZipImportError("invalid_zip", `The picture ${name} could not be read from the archive.`);
  }
}
