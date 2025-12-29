import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export { openai, OPENAI_API_KEY };
