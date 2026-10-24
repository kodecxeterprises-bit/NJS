import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Conversation, Message } from '../types';

interface MessagesPageProps {
  onNavigate: (path: string) => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ onNavigate }) => {
  const { user, apiFetch } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // AI Assistant Drawer
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await apiFetch('/api/messages/conversations');
      setConversations(res.conversations || []);
      if (!activeConversationId && res.conversations?.length > 0) {
        setActiveConversationId(res.conversations[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await apiFetch(`/api/messages/${convId}`);
      setMessages(res.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || !messageInput.trim()) return;

    const text = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    try {
      const res = await apiFetch('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConversationId,
          content: text,
        }),
      });

      if (res.message) {
        setMessages(prev => [...prev, res.message]);
        fetchConversations();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerAiDraft = async (type: 'intro' | 'followup' | 'pricing' | 'moq' | 'custom') => {
    const activeConv = conversations.find(c => c.id === activeConversationId);
    const partnerName = activeConv?.partnerUser?.name || 'Partner';
    const bizName = activeConv?.partnerBusiness?.businessName || 'Your Company';

    setIsAiDrafting(true);
    try {
      const res = await apiFetch('/api/ai/message-assistant', {
        method: 'POST',
        body: JSON.stringify({
          promptType: type,
          context: {
            senderName: user?.name || 'Me',
            recipientName: partnerName,
            businessName: bizName,
            customPrompt: customAiPrompt,
          },
        }),
      });

      if (res.text) {
        setMessageInput(res.text);
        setShowAiAssistant(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiDrafting(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-6rem)]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary block">
            Direct Messaging
          </span>
          <h1 className="text-2xl font-bold text-on-surface">Conversations</h1>
        </div>

        <button
          onClick={() => onNavigate('connections')}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">handshake</span>
          View All Connections
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-auto shadow-xs">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">chat</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No messages yet.</h3>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Messaging is available exclusively with connected enterprise partners to preserve high signal-to-noise quality.
          </p>
          <button
            onClick={() => onNavigate('connections')}
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">handshake</span>
            Manage Connections
          </button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
          {/* Conversation List (4 cols) */}
          <div className="md:col-span-4 border-r border-outline-variant/20 flex flex-col h-full bg-surface-container-low/30">
            <div className="p-4 border-b border-outline-variant/20">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Active Channels ({conversations.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/15">
              {conversations.map((c) => {
                const isActive = c.id === activeConversationId;
                const bizName = c.partnerBusiness?.businessName || c.partnerUser?.name || 'Enterprise Partner';

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveConversationId(c.id)}
                    className={`p-4 transition-all cursor-pointer flex items-start gap-3 ${
                      isActive ? 'bg-surface-container-lowest border-l-4 border-primary' : 'hover:bg-surface-container-high/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {bizName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-bold text-sm text-on-surface truncate">{bizName}</h4>
                        {c.unreadCount ? (
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">
                        {c.lastMessageSnippet || 'Conversation initiated'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Stream & Composer (8 cols) */}
          <div className="md:col-span-8 flex flex-col h-full">
            {/* Chat Header */}
            <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  {activeConv?.partnerBusiness?.businessName?.charAt(0) || 'P'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">
                    {activeConv?.partnerBusiness?.businessName || 'Connected Business'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {activeConv?.partnerBusiness?.industry || 'Verified Tier-1'} • Secure B2B Channel
                  </p>
                </div>
              </div>

              {/* AI Assistant Quick Toggle */}
              <button
                onClick={() => setShowAiAssistant(!showAiAssistant)}
                className="px-3.5 py-1.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>AI Message Assistant</span>
              </button>
            </div>

            {/* AI Assistant Drawer / Options */}
            {showAiAssistant && (
              <div className="p-4 bg-surface-container border-b border-outline-variant/30 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
                    <span>AI Writing Assistant (Gemini)</span>
                  </div>
                  <button onClick={() => setShowAiAssistant(false)} className="text-xs text-on-surface-variant hover:text-on-surface">
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleTriggerAiDraft('intro')}
                    disabled={isAiDrafting}
                    className="px-3 py-1.5 rounded-lg bg-surface text-xs font-medium hover:bg-surface-container-lowest transition-colors border border-outline-variant/30"
                  >
                    "Help me introduce myself."
                  </button>
                  <button
                    onClick={() => handleTriggerAiDraft('followup')}
                    disabled={isAiDrafting}
                    className="px-3 py-1.5 rounded-lg bg-surface text-xs font-medium hover:bg-surface-container-lowest transition-colors border border-outline-variant/30"
                  >
                    "Write a professional follow-up."
                  </button>
                  <button
                    onClick={() => handleTriggerAiDraft('pricing')}
                    disabled={isAiDrafting}
                    className="px-3 py-1.5 rounded-lg bg-surface text-xs font-medium hover:bg-surface-container-lowest transition-colors border border-outline-variant/30"
                  >
                    "Ask about pricing."
                  </button>
                  <button
                    onClick={() => handleTriggerAiDraft('moq')}
                    disabled={isAiDrafting}
                    className="px-3 py-1.5 rounded-lg bg-surface text-xs font-medium hover:bg-surface-container-lowest transition-colors border border-outline-variant/30"
                  >
                    "Ask about minimum order quantity."
                  </button>
                </div>

                {isAiDrafting && (
                  <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    Synthesizing message draft...
                  </p>
                )}
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-surface">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant text-xs sm:text-sm">
                  No messages yet. Send your introduction below or use the AI Assistant!
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderUserId === user?.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-3 rounded-2xl text-xs sm:text-sm shadow-xs leading-relaxed whitespace-pre-wrap ${
                          isMe
                            ? 'bg-primary-container text-on-primary-container rounded-br-xs'
                            : 'bg-surface-container-lowest text-on-surface border border-outline-variant/20 rounded-bl-xs'
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className="text-[10px] text-on-surface-variant/70 mt-1 px-1">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center gap-3">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message... (AI assists draft, you review before sending)"
                className="flex-1 px-4 py-3 bg-surface rounded-xl text-xs sm:text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
              <button
                type="submit"
                disabled={isSending || !messageInput.trim()}
                className="px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold text-xs sm:text-sm flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
