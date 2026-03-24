'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ChatPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [user, setUser] = useState<any>(null);
  const [companion, setCompanion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const userRes = await fetch('/api/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        // Get companion info
        const companionRes = await fetch(`/api/companions/${companionId}`);
        if (companionRes.ok) {
          const companionData = await companionRes.json();
          setCompanion(companionData.companion);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !companion) {
    return (
      <Card className="text-center py-12">
        <p className="text-white/60">Unable to load chat</p>
        <Link href="/client/browse">
          <Button className="mt-4">Browse Companions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px]">
      <Card className="h-full flex flex-col overflow-hidden">
        <ChatWindow
          companionId={companionId}
          companionName={companion.name}
          companionAvatar={companion.avatarUrl}
          currentUserId={user.id}
          currentUserRole="CLIENT"
          isClient={true}
        />
      </Card>
    </div>
  );
}
