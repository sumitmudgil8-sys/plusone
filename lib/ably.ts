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

/**
 * Chat room channel name for a client-companion pair.
 *
 * IMPORTANT: Ably capability wildcards only match at `:` segment boundaries,
 * and each `*` matches exactly one segment (`**` is NOT valid syntax). A
 * hyphenated name like `chat-abc-xyz` is a single segment — `chat-*` would not
 * match it. We use `:` separators and the token capability `chat:*:*` to
 * match the two ID segments. The room id is stable per pair regardless of
 * who is client/companion as long as both ends build it the same way, so
 * callers must always pass (clientId, companionId) in that order.
 */
export function getChatRoomChannelName(clientId: string, companionId: string): string {
  return `chat:${clientId}:${companionId}`;
}
