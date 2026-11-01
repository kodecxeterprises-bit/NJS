import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { Conversation, Message } from '../types';

interface MessagesPageProps {
  onNavigate: (path: string) => void;
}

interface ChatConversation extends Conversation {
  partnerUserId: string;
  lastMessageSnippet: string;
  lastMessageAt: string;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'B'
  );
}

function formatMessageTime(value?: string): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConversationTime(value?: string): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  if (date.toDateString() === new Date().toDateString()) {
    return formatMessageTime(value);
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  onNavigate,
}) => {
  const { user, businessProfile, apiFetch } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId
  );

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingConversations(true);
    setLoadError('');

    try {
      const connectionResponse = await apiFetch('/api/connections');

      const acceptedConnections = (
        connectionResponse.connections ?? []
      ).filter(
        (connection: any) => connection.status === 'accepted'
      );

      if (acceptedConnections.length === 0) {
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        return;
      }

      const { data: conversationRows, error: conversationError } =
        await supabase
          .from('conversations')
          .select(
            'id, user_a, user_b, created_at, last_message_at'
          )
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order('created_at', { ascending: false });

      if (conversationError) throw conversationError;

      const rows = conversationRows ?? [];

      if (rows.length === 0) {
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        return;
      }

      const conversationIds = rows.map((row) => row.id);

      const { data: messageRows, error: messageError } =
        await supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, content, is_read, created_at'
          )
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      const allMessages = messageRows ?? [];

      const mapped: ChatConversation[] = rows
        .map((row) => {
          const partnerUserId =
            row.user_a === user.id ? row.user_b : row.user_a;

          const connection = acceptedConnections.find(
            (item: any) =>
              item.requesterUserId === partnerUserId ||
              item.targetUserId === partnerUserId
          );

          if (!connection?.partnerBusiness) return null;

          const partnerBusiness = connection.partnerBusiness;

          const conversationMessages = allMessages.filter(
            (message) => message.conversation_id === row.id
          );

          const latestMessage = conversationMessages[0];

          const unreadCount = conversationMessages.filter(
            (message) =>
              message.sender_id !== user.id && !message.is_read
          ).length;

          return {
            id: row.id,
            participantUserIds: [row.user_a, row.user_b],
            participantBusinessIds: [
              row.user_a === user.id
                ? businessProfile?.id ?? ''
                : partnerBusiness.id,
              row.user_b === user.id
                ? businessProfile?.id ?? ''
                : partnerBusiness.id,
            ],
            partnerUserId,
            partnerUser: {
              id: partnerUserId,
              name: partnerBusiness.businessName,
            },
            partnerBusiness,
            createdAt: row.created_at,
            lastMessageAt:
              latestMessage?.created_at ??
              row.last_message_at ??
              row.created_at,
            lastMessageSnippet:
              latestMessage?.content ?? 'Start your conversation',
            unreadCount,
          } as ChatConversation;
        })
        .filter(
          (item): item is ChatConversation => item !== null
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime()
        );

      setConversations(mapped);

      setActiveConversationId((current) => {
        if (current && mapped.some((item) => item.id === current)) {
          return current;
        }

        return mapped[0]?.id ?? null;
      });
    } catch (error: any) {
      console.error('Conversation loading failed:', error);
      setLoadError(
        error.message || 'Could not load your conversations.'
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user?.id, businessProfile?.id, apiFetch]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      setIsLoadingMessages(true);

      try {
        const { data, error } = await supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, content, is_read, created_at'
          )
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const mappedMessages: Message[] = (data ?? []).map(
          (message) => ({
            id: message.id,
            conversationId: message.conversation_id,
            senderUserId: message.sender_id,
            senderBusinessId:
              message.sender_id === user?.id
                ? businessProfile?.id ?? ''
                : activeConversation?.partnerBusiness?.id ?? '',
            recipientUserId:
              message.sender_id === user?.id
                ? activeConversation?.partnerUserId ?? ''
                : user?.id ?? '',
            content: message.content,
            isRead: message.is_read,
            createdAt: message.created_at,
          })
        );

        setMessages(mappedMessages);
      } catch (error: any) {
        console.error('Message loading failed:', error);
        showToast(
          error.message || 'Could not load messages.',
          'error'
        );
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [
      user?.id,
      businessProfile?.id,
      activeConversation?.partnerBusiness?.id,
      activeConversation?.partnerUserId,
      showToast,
    ]
  );

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversationId) {
      void fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchMessages]);
  // Mark incoming messages as read while their conversation is open.
  useEffect(() => {
    if (
      !activeConversationId ||
      !user?.id ||
      isLoadingMessages
    ) {
      return;
    }

    const unreadIds = messages
      .filter(
        (message) =>
          message.senderUserId !== user.id && !message.isRead
      )
      .map((message) => message.id);

    if (unreadIds.length === 0) return;

    let active = true;

    const markMessagesAsRead = async () => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('conversation_id', activeConversationId)
        .eq('is_read', false);

      if (error) {
        console.error('Unable to mark messages as read:', error);
        return;
      }

      if (!active) return;

      setMessages((current) =>
        current.map((message) =>
          unreadIds.includes(message.id)
            ? { ...message, isRead: true }
            : message
        )
      );

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    };

    void markMessagesAsRead();

    return () => {
      active = false;
    };
  }, [
    activeConversationId,
    user?.id,
    messages,
    isLoadingMessages,
  ]);

  // LIVE MESSAGE SUBSCRIPTION
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const channel = supabase
      .channel(`njs-chat-${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const incoming = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            is_read: boolean;
            created_at: string;
          };

          const newMessage: Message = {
            id: incoming.id,
            conversationId: incoming.conversation_id,
            senderUserId: incoming.sender_id,
            senderBusinessId:
              incoming.sender_id === user.id
                ? businessProfile?.id ?? ''
                : activeConversation?.partnerBusiness?.id ?? '',
            recipientUserId:
              incoming.sender_id === user.id
                ? activeConversation?.partnerUserId ?? ''
                : user.id,
            content: incoming.content,
            isRead: incoming.is_read,
            createdAt: incoming.created_at,
          };

          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, newMessage];
          });

          setConversations((current) =>
            current
              .map((conversation) =>
                conversation.id === activeConversationId
                  ? {
                      ...conversation,
                      lastMessageSnippet: incoming.content,
                      lastMessageAt: incoming.created_at,
                    }
                  : conversation
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessageAt).getTime() -
                  new Date(a.lastMessageAt).getTime()
              )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            is_read: boolean;
          };

          setMessages((current) =>
            current.map((message) =>
              message.id === updated.id
                ? { ...message, isRead: updated.is_read }
                : message
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('NJS chat realtime:', status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    activeConversationId,
    user?.id,
    businessProfile?.id,
    activeConversation?.partnerBusiness?.id,
    activeConversation?.partnerUserId,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  const handleSendMessage = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const content = messageInput.trim();

    if (!activeConversationId || !content || isSending) return;

    if (content.length > 10000) {
      showToast(
        'Messages cannot exceed 10,000 characters.',
        'error'
      );
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: user?.id,
          content,
        })
        .select(
          'id, conversation_id, sender_id, content, is_read, created_at'
        )
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        conversationId: data.conversation_id,
        senderUserId: data.sender_id,
        senderBusinessId: businessProfile?.id ?? '',
        recipientUserId:
          activeConversation?.partnerUserId ?? '',
        content: data.content,
        isRead: data.is_read,
        createdAt: data.created_at,
      };

      setMessages((current) => {
        if (current.some((message) => message.id === data.id)) {
          return current;
        }

        return [...current, newMessage];
      });

      setMessageInput('');

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  lastMessageSnippet: content,
                  lastMessageAt: data.created_at,
                }
              : conversation
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
          )
      );
    } catch (error: any) {
      console.error('Message sending failed:', error);
      showToast(
        error.message || 'Failed to send message.',
        'error'
      );
    } finally {
      setIsSending(false);
    }
  };
  return (
    <div className="flex flex-col w-full h-[calc(100dvh-8rem)] min-h-[480px] gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary block">
            Direct Messaging
          </span>

          <h1 className="text-2xl font-bold text-on-surface">
            Conversations
          </h1>

          <p className="text-xs text-on-surface-variant mt-1">
            Private messaging with your connected business partners.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchConversations()}
            disabled={isLoadingConversations}
            className="rounded-xl border border-outline-variant/40 p-2.5 text-on-surface hover:bg-surface-container-low"
            title="Refresh conversations"
          >
            <span className="material-symbols-outlined text-xl">
              refresh
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('connections')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container"
          >
            <span className="material-symbols-outlined text-lg">
              handshake
            </span>
            Connections
          </button>
        </div>
      </div>

      {/* Error message */}
      {loadError && (
        <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">
          {loadError}
          <button
            type="button"
            onClick={() => void fetchConversations()}
            className="ml-2 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoadingConversations ? (
        <div className="flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-3xl text-primary animate-spin">
              progress_activity
            </span>
            <p className="text-sm text-on-surface-variant mt-3">
              Loading your conversations...
            </p>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        /* Empty state */
        <div className="flex-1 bg-surface-container-lowest rounded-2xl p-8 sm:p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">
              forum
            </span>
          </div>

          <h3 className="text-xl font-bold text-on-surface mb-2">
            No conversations yet
          </h3>

          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed max-w-md">
            Once a business connection is accepted, you can start a private
            conversation with that business right here.
          </p>

          <button
            type="button"
            onClick={() => onNavigate('connections')}
            className="bg-primary px-6 py-3 rounded-xl text-sm font-semibold text-on-primary hover:opacity-90 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">
              handshake
            </span>
            Manage Connections
          </button>
        </div>
      ) : (
        /* Messaging layout */
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">

          {/* Conversation sidebar */}
          <aside
            className={`${
              activeConversationId ? 'hidden md:flex' : 'flex'
            } md:col-span-4 border-r border-outline-variant/20 flex-col min-h-0 bg-surface-container-low/30`}
          >
            <div className="p-4 border-b border-outline-variant/20">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Business Partners ({conversations.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/15">
              {conversations.map((conversation) => {
                const name =
                  conversation.partnerBusiness?.businessName ||
                  conversation.partnerUser?.name ||
                  'Business Partner';

                const isActive =
                  conversation.id === activeConversationId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      setActiveConversationId(conversation.id)
                    }
                    className={`w-full text-left p-4 transition-all flex items-start gap-3 ${
                      isActive
                        ? 'bg-surface-container-lowest border-l-4 border-primary'
                        : 'hover:bg-surface-container-high/40'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-on-surface truncate">
                          {name}
                        </h4>

                        <span className="text-[10px] text-on-surface-variant shrink-0">
                          {formatConversationTime(
                            conversation.lastMessageAt
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant truncate mt-1">
                        {conversation.lastMessageSnippet}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Active chat */}
          <section
            className={`${
              activeConversationId ? 'flex' : 'hidden md:flex'
            } md:col-span-8 flex-col min-h-0`}
          >
            {activeConversation ? (
              <>
                {/* Chat header */}
                <header className="p-3 sm:p-4 border-b border-outline-variant/20 flex items-center gap-3 bg-surface-container-lowest">
                  <button
                    type="button"
                    onClick={() => setActiveConversationId(null)}
                    className="md:hidden rounded-lg p-2 hover:bg-surface-container-low"
                    aria-label="Back to conversations"
                  >
                    <span className="material-symbols-outlined">
                      arrow_back
                    </span>
                  </button>

                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {getInitials(
                      activeConversation.partnerBusiness?.businessName ||
                        'Partner'
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-on-surface truncate">
                      {activeConversation.partnerBusiness?.businessName ||
                        'Connected Business'}
                    </h3>

                    <p className="text-xs text-on-surface-variant truncate">
                      {activeConversation.partnerBusiness?.industry ||
                        'Business Partner'}{' '}
                      · Connected on NJS
                    </p>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Connected
                  </span>
                </header>

                {/* Message history */}
                <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-surface">
                  {isLoadingMessages ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl text-primary animate-spin">
                        progress_activity
                      </span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-2xl">
                          waving_hand
                        </span>
                      </div>

                      <h3 className="font-bold text-on-surface mt-4">
                        Start the conversation
                      </h3>

                      <p className="text-sm text-on-surface-variant mt-2 max-w-sm">
                        Introduce your business, discuss opportunities, or
                        simply say hello.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isMe =
                        message.senderUserId === user?.id;

                      return (
                        <div
                          key={message.id}
                          className={`flex flex-col ${
                            isMe ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[88%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-xs leading-relaxed whitespace-pre-wrap break-words ${
                              isMe
                                ? 'bg-primary-container text-on-primary-container rounded-br-sm'
                                : 'bg-surface-container-lowest text-on-surface border border-outline-variant/20 rounded-bl-sm'
                            }`}
                          >
                            {message.content}
                          </div>

                          <span className="text-[10px] text-on-surface-variant/70 mt-1 px-1">
                            {formatMessageTime(message.createdAt)}
                            {isMe && (
                              <>
                                {' · '}
                                {message.isRead ? (
                                  <span className="text-primary font-semibold">
                                    Seen ✓✓
                                  </span>
                                ) : (
                                  'Sent ✓'
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center gap-2 sm:gap-3"
                >
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(event) =>
                      setMessageInput(event.target.value)
                    }
                    maxLength={10000}
                    placeholder="Write a message..."
                    className="flex-1 min-w-0 px-4 py-3 bg-surface rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                  />

                  <button
                    type="submit"
                    disabled={
                      isSending || !messageInput.trim()
                    }
                    className="px-4 sm:px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                  >
                    <span className="hidden sm:inline">
                      {isSending ? 'Sending...' : 'Send'}
                    </span>

                    <span className="material-symbols-outlined text-lg">
                      {isSending ? 'hourglass_top' : 'send'}
                    </span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <span className="material-symbols-outlined text-4xl text-primary">
                  forum
                </span>

                <h3 className="font-bold text-on-surface mt-3">
                  Select a conversation
                </h3>

                <p className="text-sm text-on-surface-variant mt-1">
                  Choose a connected business to start messaging.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;