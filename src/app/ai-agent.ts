import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export type AuraAgentResult =
  | {
      type: 'reminder';
      task: string;
      time?: string; // HH:mm
      date?: string; // today|tomorrow|YYYY-MM-DD
      recurrence?: 'once' | 'daily' | 'weekly' | 'monthly';
    }
  | {
      type: 'note';
      content: string;
    };

export type ParseOptions = {
  apiKey: string;
  model?: string;
  timezone?: string;
  nowISO?: string;
};

const RECURRENCES = ['once', 'daily', 'weekly', 'monthly'] as const;
const TYPES = ['reminder', 'note'] as const;

function isRecurrence(v: unknown): v is (typeof RECURRENCES)[number] {
  return typeof v === 'string' && (RECURRENCES as readonly string[]).includes(v);
}

function safeJsonParse<T>(text: string): T {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Model did not return JSON');
  }
  return JSON.parse(text.slice(first, last + 1)) as T;
}

/**
 * Uses Google Gemini to parse a user's natural-language command into a JSON object.
 *
 * Examples:
 *  - "Remind me to call Mom at 5pm." => {"type":"reminder","task":"Call Mom","time":"17:00","date":"today"}
 *  - "I feel tired" => {"type":"note","content":"User expressed feeling tired."}
 */
export async function aiAgentParseToJson(
  userText: string,
  options: ParseOptions,
): Promise<AuraAgentResult> {
  const text = (userText ?? '').trim();
  if (!text) {
    return { type: 'note', content: 'User provided empty input.' };
  }

  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: options.model ?? 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING, format: 'enum', enum: [...TYPES] },
          task: { type: SchemaType.STRING },
          time: { type: SchemaType.STRING },
          date: { type: SchemaType.STRING },
          recurrence: { type: SchemaType.STRING, format: 'enum', enum: [...RECURRENCES] },
          content: { type: SchemaType.STRING },
        },
        required: ['type'],
      },
    },
  });

  const nowISO = options.nowISO ?? new Date().toISOString();
  const tz = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const prompt =
    `You are an assistant that converts user messages into a single JSON object.\n` +
    `Rules:\n` +
    `- If the user is asking to be reminded, output type=\"reminder\" with: task (short), time (HH:mm if present), date (today/tomorrow/YYYY-MM-DD if present), recurrence (once/daily/weekly/monthly if implied).\n` +
    `- If the user is NOT asking for a reminder, output type=\"note\" with: content (brief, third-person).\n` +
    `- Output JSON only (no markdown).\n` +
    `Context: nowISO=${nowISO}, timezone=${tz}.\n` +
    `User: ${text}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  // Prefer schema/mime JSON, but still parse defensively.
  const parsed = safeJsonParse<any>(raw);

  if (parsed?.type === 'reminder') {
    const out: AuraAgentResult = {
      type: 'reminder',
      task: String(parsed.task ?? '').trim() || text,
      time: parsed.time ? String(parsed.time) : undefined,
      date: parsed.date ? String(parsed.date) : undefined,
      recurrence: isRecurrence(parsed.recurrence) ? parsed.recurrence : undefined,
    };
    return out;
  }

  const content = String(parsed?.content ?? '').trim();
  return {
    type: 'note',
    content: content || `User said: ${text}`,
  };
}
