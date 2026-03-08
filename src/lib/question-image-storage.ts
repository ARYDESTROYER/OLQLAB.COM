import { del, put } from "@vercel/blob";

export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_QUESTION_IMAGE_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function sanitizeFileStem(input: string) {
  const stem = input
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return stem || "question-image";
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
      error: "Image exceeds the 5 MB limit.",
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
    throw new Error(validation.error);
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

export function isManagedQuestionImageUrl(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("blob.vercel-storage.com") &&
      parsed.pathname.includes("/question-images/")
    );
  } catch {
    return false;
  }
}

export async function deleteManagedQuestionImage(url: string | null | undefined) {
  if (!isManagedQuestionImageUrl(url)) return false;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;

  await del(url as string, { token });
  return true;
}