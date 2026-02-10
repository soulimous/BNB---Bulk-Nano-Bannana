
import { GoogleGenAI } from "@google/genai";
import { GeminiModel, Resolution } from "../types";

/**
 * Encodes a file to a base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

const getClosestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const ratio = width / height;
  const options = [
    { name: "1:1", val: 1 },
    { name: "3:4", val: 3/4 },
    { name: "4:3", val: 4/3 },
    { name: "9:16", val: 9/16 },
    { name: "16:9", val: 16/9 },
  ] as const;
  return options.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).name;
};

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
};

export const processImageEdit = async (
  file: File,
  prompt: string,
  model: GeminiModel,
  resolution: Resolution
): Promise<{ imageUrl: string; width: number; height: number; size: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);
  const dims = await getImageDimensions(file);

  const config: any = {};
  if (model === GeminiModel.PRO) {
    config.imageConfig = {
      aspectRatio: getClosestAspectRatio(dims.width, dims.height),
      imageSize: resolution
    };
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        },
        {
          text: `Preserve the exact composition and alignment of the original image. Edit the image as follows: ${prompt}`
        }
      ]
    },
    config
  });

  let editedBase64: string | null = null;
  
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        editedBase64 = part.inlineData.data;
        break;
      }
    }
  }

  if (!editedBase64) {
    throw new Error("No image was generated in the response.");
  }

  const editedUrl = `data:image/png;base64,${editedBase64}`;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        imageUrl: editedUrl,
        width: img.width,
        height: img.height,
        size: Math.round((editedBase64!.length * 3) / 4)
      });
    };
    img.src = editedUrl;
  });
};
