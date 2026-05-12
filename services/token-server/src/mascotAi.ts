import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  decideMascotAction,
  detectEscalationNeed,
  normalizeEscalationTopic,
  type MascotChatMessage,
  type MascotDecision,
  type MascotDecisionAction,
  type MascotDecisionInput,
} from '@nokta-hoop/hoop-core';

type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type RawMascotDecision = Partial<{
  action: string;
  answer: string;
  confidence: number;
  reason: string;
  topic: string;
  question: string;
}>;

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const PER_LLM_TIMEOUT_MS = 12_000;

export async function decideMascotActionWithAi(
  input: MascotDecisionInput,
): Promise<MascotDecision> {
  const deterministicDecision = decideMascotAction(input);

  // Deterministic eskalasyon ihtiyacı (uzmanlık gerektiren konular) LLM beklememeli
  const explicitEscalation = detectEscalationNeed(input.message);
  if (explicitEscalation || deterministicDecision.action === 'escalate') {
    return {
      ...deterministicDecision,
      source: 'deterministic',
      reason: explicitEscalation
        ? `${deterministicDecision.reason}. User explicitly asked for expert support.`
        : `${deterministicDecision.reason}. Deterministic expert-domain rule overrides LLM answer.`,
    };
  }

  const providers = [
    {
      name: 'Groq',
      apiKey: process.env.GROQ_API_KEY?.trim(),
      request: (input: MascotDecisionInput, key: string) => requestGroqDecision(input, key),
    },
    {
      name: 'OpenAI',
      apiKey: process.env.OPENAI_API_KEY?.trim(),
      request: (input: MascotDecisionInput, key: string) => requestOpenAIDecision(input, key),
    },
    {
      name: 'Gemini',
      apiKey: process.env.GEMINI_API_KEY?.trim(),
      request: (input: MascotDecisionInput, key: string) => requestGeminiDecision(input, key),
    },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.apiKey) {
      continue;
    }

    try {
      const decision = await withTimeout(
        provider.request(input, provider.apiKey),
        PER_LLM_TIMEOUT_MS,
        provider.name,
      );
      return coerceMascotDecision(decision, input, deterministicDecision, provider.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Mascot LLM (${provider.name}) failed:`, message);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  // Tüm AI sağlayıcıları başarısız olduysa deterministic fallback
  return {
    ...deterministicDecision,
    reason: `${deterministicDecision.reason} All LLMs failed: ${errors.join(', ')}`,
  };
}

async function requestGroqDecision(
  input: MascotDecisionInput,
  apiKey: string,
): Promise<RawMascotDecision> {
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    messages: buildLlmMessages(input),
    model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    temperature: 0.2,
    max_tokens: 420,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return parseDecisionJson(content);
}

async function requestOpenAIDecision(
  input: MascotDecisionInput,
  apiKey: string,
): Promise<RawMascotDecision> {
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    messages: buildLlmMessages(input),
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    temperature: 0.2,
    max_tokens: 420,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return parseDecisionJson(content);
}

async function requestGeminiDecision(
  input: MascotDecisionInput,
  apiKey: string,
): Promise<RawMascotDecision> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 420,
    },
  });

  const messages = buildLlmMessages(input);
  const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
  const history = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const chat = model.startChat({
    history: history.slice(0, -1),
    systemInstruction: systemPrompt,
  });

  const lastMessage = history[history.length - 1]?.parts[0]?.text || '';
  const result = await chat.sendMessage(lastMessage);
  const content = result.response.text();
  if (!content) throw new Error('Empty response');
  return parseDecisionJson(content);
}

function buildLlmMessages(input: MascotDecisionInput): LlmChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'Sen Nokta Maskot adında Türkçe konuşan bir human-in-the-loop asistansın.',
        'Görevin kullanıcının sorusuna ya kısa ve pratik cevap vermek ya da mentor/uzman desteği gerektiğine karar vermektir.',
        'Mentor desteği şu durumlarda gerekir: kullanıcı açıkça uzman/mentor isterse, konu hukuki/sağlık/finans/vergi/regülasyon gibi riskliyse, yatırım/pazar doğrulaması için gerçek uzman yorumu gerekiyorsa, cevap için kurum/mentor bilgisi şartsa veya soru algoritma/veri yapıları/akademik teknik ispat gibi uzmanlık gerektiren bir alandaysa.',
        'Özellikle çizge/graph, Hamilton döngüsü, algoritma karmaşıklığı, NP-complete/NP-hard ve ispat sorularında action mutlaka escalate olmalıdır.',
        'Genel fikir geliştirme, MVP kapsamı, demo akışı, ürünleştirme, teknik açıklama ve yazım yardımında önce sen cevap ver.',
        'Cevaplar 1-3 cümle, net, Türkçe ve samimi olsun.',
        'Sadece geçerli JSON döndür. Markdown, açıklama veya kod bloğu yazma.',
        'action escalate ise answer kullanıcıya uzman desteği öneren ve onay isteyen bir cümle olmalı.',
        'JSON şeması: {"action":"answer|escalate","answer":"string","confidence":0.0,"reason":"string","topic":"string","question":"string"}',
      ].join(' '),
    },
    ...historyToLlmMessages(input.history ?? []),
    {
      role: 'user',
      content: input.message,
    },
  ];
}

function historyToLlmMessages(history: MascotChatMessage[]): LlmChatMessage[] {
  return history
    .slice(-10)
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.text,
    }));
}

function parseDecisionJson(content: string): RawMascotDecision {
  const trimmed = content.trim();
  const json = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  const parsed = JSON.parse(json) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Response is not a valid JSON object.');
  }

  return parsed as RawMascotDecision;
}

function coerceMascotDecision(
  raw: RawMascotDecision,
  input: MascotDecisionInput,
  fallback: MascotDecision,
  providerName: string,
): MascotDecision {
  const action = raw.action === 'escalate' ? 'escalate' : 'answer';
  const answer =
    typeof raw.answer === 'string' && raw.answer.trim().length > 0
      ? raw.answer.trim()
      : fallback.answer;
  const reason =
    typeof raw.reason === 'string' && raw.reason.trim().length > 0
      ? raw.reason.trim()
      : `LLM decision via ${providerName}.`;
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : fallback.confidence;

  if (action === 'answer') {
    return { action, answer, confidence, reason, source: 'llm' };
  }

  const question =
    typeof raw.question === 'string' && raw.question.trim().length >= 4
      ? raw.question.trim()
      : input.message.trim();
  const topic =
    typeof raw.topic === 'string' && raw.topic.trim().length >= 2
      ? normalizeEscalationTopic(raw.topic)
      : normalizeEscalationTopic(question);

  return { action, answer, confidence, reason, source: 'llm', question, topic };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${providerName} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

