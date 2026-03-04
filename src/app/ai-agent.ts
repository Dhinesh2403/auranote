import Groq from 'groq-sdk';

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

export type AuraAgentResponse = {
  /** Parsed structured intent for the app to execute */
  result: AuraAgentResult;
  /** Human-friendly message suitable for chat UI */
  reply: string;
};

export type ParseOptions = {
  apiKey: string;
  /** Groq model id. Example: 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile'. */
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

function formatTimeHHmmToLocal(hhmm?: string): string | undefined {
  if (!hhmm) return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;

  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(date?: string): string | undefined {
  if (!date) return undefined;
  if (date === 'today' || date === 'tomorrow') return date;
  // Leave YYYY-MM-DD as-is (can be localized later if desired)
  return date;
}

function toHumanReply(result: AuraAgentResult): string {
  if (result.type === 'reminder') {
    const time = formatTimeHHmmToLocal(result.time);
    const date = formatDateLabel(result.date);

    const whenParts = [time, date].filter(Boolean) as string[];
    const when = whenParts.length ? whenParts.join(' ') : undefined;

    const recur =
      result.recurrence && result.recurrence !== 'once'
        ? ` (${result.recurrence})`
        : '';

    if (when) return `Hey buddy, your reminder has been set for ${when}: ${result.task}.${recur}`.trim();
    return `Hey buddy, your reminder has been set: ${result.task}.${recur}`.trim();
  }

  return `Noted: ${result.content}`;
}

async function callGroqJson(userText: string, options: ParseOptions) {
  const nowISO = options.nowISO ?? new Date().toISOString();
  const tz = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const modelName = options.model ?? 'llama-3.1-8b-instant';

  const client = new Groq({
    apiKey: options.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const system =
    `You are an assistant that converts user messages into a single JSON object.\n` +
    `Rules:\n` +
    `- If the user is asking to be reminded, output type=\"reminder\" with: task (short), time (HH:mm if present), date (today/tomorrow/YYYY-MM-DD if present), recurrence (once/daily/weekly/monthly if implied).\n` +
    `- If the user is NOT asking for a reminder, output type=\"note\" with: content (brief, third-person).\n` +
    `- Output JSON only (no markdown, no extra keys).\n` +
    `Context: nowISO=${nowISO}, timezone=${tz}.`;

  const resp = await client.chat.completions.create({
    model: modelName,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
  });

  return resp.choices?.[0]?.message?.content ?? '';
}

export async function aiAgentParse(
  userText: string,
  options: ParseOptions,
): Promise<AuraAgentResponse> {
  const text = (userText ?? '').trim();
  if (!text) {
    const result: AuraAgentResult = { type: 'note', content: 'User provided empty input.' };
    return { result, reply: toHumanReply(result) };
  }

  const raw = await callGroqJson(text, options);
  const parsed = safeJsonParse<any>(raw);

  let result: AuraAgentResult;

  if (parsed?.type === 'reminder') {
    result = {
      type: 'reminder',
      task: String(parsed.task ?? '').trim() || text,
      time: parsed.time ? String(parsed.time) : undefined,
      date: parsed.date ? String(parsed.date) : undefined,
      recurrence: isRecurrence(parsed.recurrence) ? parsed.recurrence : undefined,
    };
  } else {
    const content = String(parsed?.content ?? '').trim();
    result = {
      type: 'note',
      content: content || `User said: ${text}`,
    };
  }

  return { result, reply: toHumanReply(result) };
}

export async function aiAgentParseToJson(
  userText: string,
  options: ParseOptions,
): Promise<AuraAgentResult> {
  const { result } = await aiAgentParse(userText, options);
  return result;
}
