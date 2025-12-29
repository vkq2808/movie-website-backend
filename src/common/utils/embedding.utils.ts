import { openai } from '@/config/openapi.config';

export async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
  });

  return response.data[0].embedding; // number[]
}
