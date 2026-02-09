
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

export const processImageEdit = async (
  file: File,
  prompt: string,
  model: GeminiModel,
  resolution: Resolution
): Promise<{ imageUrl: string; width: number; height: number; size: number }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);

  const config: any = {};
  if (model === GeminiModel.PRO) {
    config.imageConfig = {
      aspectRatio: "1:1", // Standard for many edits, though ideally we'd preserve.
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
          text: prompt
        }
      ]
    },
    config
  });

  let editedBase64: string | null = null;
  
  // Extract image from parts
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
  
  // Create a temporary image to get dimensions
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        imageUrl: editedUrl,
        width: img.width,
        height: img.height,
        size: Math.round((editedBase64!.length * 3) / 4) // Approx size in bytes
      });
    };
    img.src = editedUrl;
  });
};
