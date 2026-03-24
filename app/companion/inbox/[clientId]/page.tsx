'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CompanionChatPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [user, setUser] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
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

        // Get client info
        const clientRes = await fetch(`/api/users/${clientId}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          setClient(clientData.user);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !client) {
    return (
      <Card className="text-center py-12">
        <p className="text-white/60">Unable to load chat</p>
        <Link href="/companion/inbox">
          <Button className="mt-4">Back to Inbox</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px]">
      <Card className="h-full flex flex-col overflow-hidden">
        <ChatWindow
          companionId={clientId}
          companionName={client.clientProfile?.name || 'Client'}
          companionAvatar={client.clientProfile?.avatarUrl}
          currentUserId={user.id}
          currentUserRole="COMPANION"
          isClient={false}
        />
      </Card>
    </div>
  );
}
