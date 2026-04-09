'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Legacy chat page — redirects to the unified inbox chat page.
export default function ChatRedirect() {
  const { companionId } = useParams<{ companionId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/client/inbox/${companionId}`);
  }, [companionId, router]);

  return null;
}
