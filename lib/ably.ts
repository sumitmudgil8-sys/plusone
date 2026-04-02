import Ably from 'ably';

let ablyClient: Ably.Rest | null = null;

export function getAblyClient(): Ably.Rest {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    throw new Error('ABLY_API_KEY environment variable is not set');
  }
  if (!ablyClient) {
    ablyClient = new Ably.Rest({ key: apiKey });
  }
  return ablyClient;
}

/** Each user has one inbound channel for messages and typing events. */
export function getUserChannelName(userId: string): string {
  return `private:user-${userId}`;
}
