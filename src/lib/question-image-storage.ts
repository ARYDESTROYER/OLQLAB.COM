import { del, put } from "@vercel/blob";
import { isManagedQuestionImageUrl } from "@/lib/question-image-policy";

export { isManagedQuestionImageUrl } from "@/lib/question-image-policy";

// Vercel Functions reject request bodies above 4.5 MB before route code runs.
// Four MiB leaves room for multipart field names, boundaries, alt text, and captions.
export const MAX_QUESTION_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_QUESTION_IMAGE_REQUEST_BYTES = 4.25 * 1024 * 1024;
export const MAX_QUESTION_IMAGE_ALT_CHARS = 300;
export const MAX_QUESTION_IMAGE_CAPTION_CHARS = 500;

const ALLOWED_QUESTION_IMAGE_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export class QuestionImageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionImageInputError";
  }
}

function sanitizeFileStem(input: string) {
  const stem = input
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return stem || "question-image";
}

export function hasValidQuestionImageSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return pngSignature.every((byte, index) => bytes[index] === byte);
  }

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
}

export function validateQuestionImageFile(file: File) {
  const extension = ALLOWED_QUESTION_IMAGE_MIME_TYPES.get(file.type);
  if (!extension) {
    return {
      ok: false as const,
      error: "Only JPG, PNG, and WebP images are allowed.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false as const,
      error: "Uploaded image is empty.",
    };
  }

  if (file.size > MAX_QUESTION_IMAGE_BYTES) {
    return {
      ok: false as const,
      error: "Image exceeds the 4 MB limit.",
    };
  }

  return {
    ok: true as const,
    extension,
  };
}

export async function uploadQuestionImage(input: {
  assessmentId: string;
  questionId: string;
  file: File;
}) {
  const validation = validateQuestionImageFile(input.file);
  if (!validation.ok) {
    throw new QuestionImageInputError(validation.error);
  }

  const headerBytes = new Uint8Array(await input.file.slice(0, 12).arrayBuffer());
  if (!hasValidQuestionImageSignature(input.file.type, headerBytes)) {
    throw new QuestionImageInputError(
      "Image contents do not match the declared JPG, PNG, or WebP type.",
    );
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "Question image upload is not configured. Set BLOB_READ_WRITE_TOKEN in the deployment environment.",
    );
  }

  const filePath = [
    "question-images",
    input.assessmentId,
    input.questionId,
    `${sanitizeFileStem(input.file.name)}.${validation.extension}`,
  ].join("/");

  const blob = await put(filePath, input.file, {
    access: "public",
    addRandomSuffix: true,
    token,
    contentType: input.file.type,
  });

  return blob;
}

export async function deleteManagedQuestionImage(url: string | null | undefined) {
  if (!isManagedQuestionImageUrl(url)) return false;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;

  await del(url as string, { token });
  return true;
}
