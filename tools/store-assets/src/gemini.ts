import { promises as fs } from 'fs';

export interface GeminiConfig {
  model: string;
  imageSize: string;
  aspectRatio: string;
}

export interface GeminiRequest {
  prompt: string;
  images: { path: string; mime: string }[];
}

export async function generateImage(config: GeminiConfig, req: GeminiRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const parts = [{ text: req.prompt }] as (
    | { text: string }
    | { inline_data: { data: string; mime_type: string } }
  )[];

  for (const img of req.images) {
    const data = await fs.readFile(img.path);
    parts.push({
      inline_data: {
        data: data.toString('base64'),
        mime_type: img.mime,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            imageSize: config.imageSize,
            aspectRatio: config.aspectRatio,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string } }[] };
    }[];
  };

  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }
  }

  throw new Error('Gemini response missing image data');
}
