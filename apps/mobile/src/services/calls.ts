import { getTokenServerUrl } from './transcript';

type EndCallResponse = {
  status?: string;
};

export async function requestEndCall(input: {
  callType: string;
  callId: string;
}): Promise<void> {
  const path = `/calls/${encodeURIComponent(input.callType)}/${encodeURIComponent(
    input.callId,
  )}/end`;
  const response = await fetch(`${getTokenServerUrl()}${path}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `End call request failed: ${response.status}`);
  }

  const body = (await response.json()) as EndCallResponse;
  if (body.status && body.status !== 'ended') {
    throw new Error('End call response is invalid.');
  }
}
