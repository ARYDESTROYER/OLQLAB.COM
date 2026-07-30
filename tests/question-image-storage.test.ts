import { describe, expect, it } from "vitest";
import {
  MAX_QUESTION_IMAGE_BYTES,
  hasValidQuestionImageSignature,
  isManagedQuestionImageUrl,
  validateQuestionImageFile,
} from "@/lib/question-image-storage";
import {
  isExternalQuestionImageUrl,
  normalizeQuestionImageUrl,
} from "@/lib/question-image-policy";

function imageFile(size: number, type = "image/png") {
  return new File([new Uint8Array(size)], "question.png", { type });
}

describe("question image upload limits", () => {
  it("accepts a supported image at the safe four MiB boundary", () => {
    expect(validateQuestionImageFile(imageFile(MAX_QUESTION_IMAGE_BYTES))).toEqual({
      ok: true,
      extension: "png",
    });
  });

  it("rejects oversized and unsupported files", () => {
    expect(validateQuestionImageFile(imageFile(MAX_QUESTION_IMAGE_BYTES + 1))).toEqual({
      ok: false,
      error: "Image exceeds the 4 MB limit.",
    });
    expect(validateQuestionImageFile(imageFile(1, "image/svg+xml"))).toEqual({
      ok: false,
      error: "Only JPG, PNG, and WebP images are allowed.",
    });
  });

  it("checks image magic bytes against the declared MIME type", () => {
    expect(
      hasValidQuestionImageSignature(
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(
      hasValidQuestionImageSignature(
        "image/webp",
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe(true);
    expect(hasValidQuestionImageSignature("image/png", new TextEncoder().encode("<html>"))).toBe(
      false,
    );
  });

  it("only treats HTTPS Blob hosts with an exact suffix boundary as managed", () => {
    expect(
      isManagedQuestionImageUrl(
        "https://store.public.blob.vercel-storage.com/question-images/a/q/image.png",
      ),
    ).toBe(true);
    expect(
      isManagedQuestionImageUrl(
        "https://store.public.blob.vercel-storage.com.evil.example/question-images/a/q/image.png",
      ),
    ).toBe(false);
    expect(
      isManagedQuestionImageUrl(
        "http://store.public.blob.vercel-storage.com/question-images/a/q/image.png",
      ),
    ).toBe(false);
  });

  it("allows only local question assets or managed Blob URLs", () => {
    expect(normalizeQuestionImageUrl("/question-images/reference.png")).toBe(
      "/question-images/reference.png",
    );
    expect(
      normalizeQuestionImageUrl(
        "https://store.public.blob.vercel-storage.com/question-images/a/q/image.png",
      ),
    ).toBe("https://store.public.blob.vercel-storage.com/question-images/a/q/image.png");
    expect(normalizeQuestionImageUrl("https://tracker.example/question.png")).toBeNull();
    expect(normalizeQuestionImageUrl("//tracker.example/question.png")).toBeNull();
    expect(normalizeQuestionImageUrl("/question-images/%2e%2e/private.png")).toBeNull();
    expect(
      isExternalQuestionImageUrl(
        "https://store.public.blob.vercel-storage.com/question-images/a/q/image.png",
      ),
    ).toBe(true);
  });
});
