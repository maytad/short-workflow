import { generateGoogleImage } from "./googleImage";
import { generateOpenAIImage } from "./openaiImage";
import type { GenerateImageInput, GenerateImageOutput, ImageProvider } from "./types";

type ImageProviders = {
  openai(input: GenerateImageInput): Promise<GenerateImageOutput>;
  googleGemini(input: GenerateImageInput): Promise<GenerateImageOutput>;
};

const defaultProviders: ImageProviders = {
  openai: generateOpenAIImage,
  googleGemini: generateGoogleImage,
};

export function resolveImageProvider(value = process.env.IMAGE_PROVIDER): ImageProvider {
  if (value === undefined || value === "" || value === "openai") {
    return "openai";
  }

  if (value === "google_gemini") {
    return value;
  }

  throw new Error("IMAGE_PROVIDER_invalid");
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageWithProviders(input, defaultProviders);
}

export async function generateImageWithProviders(
  input: GenerateImageInput,
  providers: ImageProviders,
): Promise<GenerateImageOutput> {
  const provider = input.provider ?? resolveImageProvider();

  switch (provider) {
    case "openai":
      return providers.openai({ ...input, provider });
    case "google_gemini":
      return providers.googleGemini({ ...input, provider });
  }
}
