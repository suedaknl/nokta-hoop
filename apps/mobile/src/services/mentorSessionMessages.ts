import type {
  MentorSessionMessage,
  MentorSessionMessageRole,
} from '@nokta-hoop/hoop-core';

import { getTokenServerUrl } from './transcript';

type MentorSessionMessageResponse = {
  message: MentorSessionMessage;
};

type MentorSessionMessageListResponse = {
  messages: MentorSessionMessage[];
};

export async function createMentorSessionMessage(input: {
  escalationId: string;
  authorId: string;
  authorName: string;
  role: MentorSessionMessageRole;
  text: string;
}): Promise<MentorSessionMessage> {
  const response = await fetch(
    `${getTokenServerUrl()}/escalations/${encodeURIComponent(
      input.escalationId,
    )}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: input.authorId,
        author_name: input.authorName,
        role: input.role,
        text: input.text,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await getResponseMessage(response, 'Mentor message failed.'));
  }

  const body = (await response.json()) as MentorSessionMessageResponse;
  if (!body.message?.id) {
    throw new Error('Mentor message response is invalid.');
  }

  return body.message;
}

export async function listMentorSessionMessages(
  escalationId: string,
): Promise<MentorSessionMessage[]> {
  const response = await fetch(
    `${getTokenServerUrl()}/escalations/${encodeURIComponent(
      escalationId,
    )}/messages`,
  );

  if (!response.ok) {
    throw new Error(await getResponseMessage(response, 'Mentor messages failed.'));
  }

  const body = (await response.json()) as MentorSessionMessageListResponse;
  if (!Array.isArray(body.messages)) {
    throw new Error('Mentor messages response is invalid.');
  }

  return body.messages;
}

async function getResponseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `${fallback} ${response.status}`;
  } catch {
    return `${fallback} ${response.status}`;
  }
}
