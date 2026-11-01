import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { Conversation, Message } from '../types';

interface MessagesPageProps { onNavigate: (path: string) => void; }
interface ChatConversation extends Conversation {
  partnerUserId: string;
  lastMessageSnippet: string;
  lastMessageAt: string;
}
interface DbMessage {
  id: string; conversation_id: string; sender_id: string; content: string;
  is_read: boolean; created_at: string; attachment_path?: string | null;
  attachment_name?: string | null; attachment_type?: string | null; attachment_size?: number | null;
}
interface AttachmentMeta { path: string; name: string; type: string; size: number; }

const BUCKET = 'message-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain',
]);

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'B';
}
function formatMessageTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatConversationTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString() === new Date().toDateString()
    ? formatMessageTime(value)
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function mapDbMessage(row: DbMessage, currentUserId: string, businessId: string, partnerUserId: string, partnerBusinessId: string): Message {
  return {
    id: row.id, conversationId: row.conversation_id, senderUserId: row.sender_id,
    senderBusinessId: row.sender_id === currentUserId ? businessId : partnerBusinessId,
    recipientUserId: row.sender_id === currentUserId ? partnerUserId : currentUserId,
    content: row.content, isRead: row.is_read, createdAt: row.created_at,
    attachmentPath: row.attachment_path ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentType: row.attachment_type ?? undefined,
    attachmentSize: row.attachment_size ?? undefined,
  };
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ onNavigate }) => {
  const { user, businessProfile, apiFetch } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{conversationId:string; messageId:string; content:string; createdAt:string}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string,string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConversation = conversations.find((item) => item.id === activeConversationId);

  const fetchConversations = useCallback(async (showLoader = true) => {
    if (!user?.id) return;
    if (showLoader) setIsLoadingConversations(true);
    setLoadError('');
    try {
      const connectionResponse = await apiFetch('/api/connections');
      const acceptedConnections = (connectionResponse.connections ?? []).filter((item: any) => item.status === 'accepted');
      if (!acceptedConnections.length) { setConversations([]); setActiveConversationId(null); setMessages([]); return; }
      const { data: rows, error: conversationError } = await supabase.from('conversations')
        .select('id,user_a,user_b,created_at,last_message_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order('created_at', { ascending: false });
      if (conversationError) throw conversationError;
      if (!rows?.length) { setConversations([]); setActiveConversationId(null); setMessages([]); return; }
      const ids = rows.map((row) => row.id);
      const { data: messageRows, error: messageError } = await supabase.from('messages')
        .select('id,conversation_id,sender_id,content,is_read,created_at,attachment_path,attachment_name,attachment_type,attachment_size')
        .in('conversation_id', ids).order('created_at', { ascending: false });
      if (messageError) throw messageError;
      const allMessages = (messageRows ?? []) as DbMessage[];
      const mapped = rows.map((row) => {
        const partnerUserId = row.user_a === user.id ? row.user_b : row.user_a;
        const connection = acceptedConnections.find((item: any) => item.requesterUserId === partnerUserId || item.targetUserId === partnerUserId);
        if (!connection?.partnerBusiness) return null;
        const partnerBusiness = connection.partnerBusiness;
        const ownMessages = allMessages.filter((message) => message.conversation_id === row.id);
        const latest = ownMessages[0];
        const unreadCount = ownMessages.filter((message) => message.sender_id !== user.id && !message.is_read).length;
        return {
          id: row.id, participantUserIds: [row.user_a,row.user_b],
          participantBusinessIds: [row.user_a === user.id ? businessProfile?.id ?? '' : partnerBusiness.id, row.user_b === user.id ? businessProfile?.id ?? '' : partnerBusiness.id],
          partnerUserId, partnerUser: { id: partnerUserId, name: partnerBusiness.businessName }, partnerBusiness,
          createdAt: row.created_at, lastMessageAt: latest?.created_at ?? row.last_message_at ?? row.created_at,
          lastMessageSnippet: latest?.attachment_name ? `📎 ${latest.attachment_name}` : latest?.content ?? 'Start your conversation', unreadCount,
        } as ChatConversation;
      }).filter((item): item is ChatConversation => item !== null)
        .sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setConversations(mapped);
      setActiveConversationId((current) => current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id ?? null);
    } catch (error: any) {
      console.error('Conversation loading failed:', error); setLoadError(error.message || 'Could not load your conversations.');
    } finally {
      if (showLoader) setIsLoadingConversations(false);
    }
  }, [user?.id, businessProfile?.id, apiFetch]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.from('messages')
        .select('id,conversation_id,sender_id,content,is_read,created_at,attachment_path,attachment_name,attachment_type,attachment_size')
        .eq('conversation_id', conversationId).order('created_at', { ascending: true });
      if (error) throw error;
      const partner = conversations.find((item) => item.id === conversationId);
      const mapped = ((data ?? []) as DbMessage[]).map((row) => mapDbMessage(row, user?.id ?? '', businessProfile?.id ?? '', partner?.partnerUserId ?? '', partner?.partnerBusiness?.id ?? ''));
      setMessages(mapped);
    } catch (error: any) {
      console.error('Message loading failed:', error); showToast(error.message || 'Could not load messages.', 'error'); setMessages([]);
    } finally { setIsLoadingMessages(false); }
  }, [user?.id, businessProfile?.id, conversations, showToast]);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (activeConversationId) void fetchMessages(activeConversationId); else setMessages([]); }, [activeConversationId, fetchMessages]);

  // Keep sidebar unread totals fresh for messages arriving in ANY conversation.
  // This is a background refresh: do not replace the open messaging UI with a loader.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`njs-unread:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void fetchConversations(false);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, fetchConversations]);

  // Mark incoming messages read when the chat is open.
  useEffect(() => {
    if (!activeConversationId || !user?.id || isLoadingMessages) return;
    const unreadIds = messages.filter((message) => message.senderUserId !== user.id && !message.isRead).map((message) => message.id);
    if (!unreadIds.length) return;
    let alive = true;
    void (async () => {
      const { error } = await supabase.from('messages').update({ is_read: true }).in('id', unreadIds).eq('conversation_id', activeConversationId).eq('is_read', false);
      if (error) { console.error('Unable to mark messages read:', error); return; }
      if (!alive) return;
      setMessages((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, isRead: true } : item));
      setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, unreadCount: 0 } : item));
    })();
    return () => { alive = false; };
  }, [activeConversationId, user?.id, messages, isLoadingMessages]);

  // Message INSERT/UPDATE stream for the open conversation.
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;
    const channel = supabase.channel(`njs-chat-db-${activeConversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, (payload) => {
        const row = payload.new as DbMessage;
        const mapped = mapDbMessage(row, user.id, businessProfile?.id ?? '', activeConversation?.partnerUserId ?? '', activeConversation?.partnerBusiness?.id ?? '');
        setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, mapped]);
        setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, lastMessageSnippet: row.attachment_name ? `📎 ${row.attachment_name}` : row.content, lastMessageAt: row.created_at, unreadCount: row.sender_id === user.id ? item.unreadCount : 0 } : item).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, (payload) => {
        const row = payload.new as DbMessage;
        setMessages((current) => current.map((item) => item.id === row.id ? { ...item, isRead: row.is_read } : item));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeConversationId, user?.id, businessProfile?.id, activeConversation?.partnerBusiness?.id, activeConversation?.partnerUserId]);

  // Private Broadcast channel for ephemeral typing state (never stored in Postgres).
  useEffect(() => {
    if (!activeConversationId || !user?.id) { setPartnerTyping(false); return; }
    const channel = supabase.channel(`njs-chat:${activeConversationId}`, { config: { private: true, broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setPartnerTyping(Boolean(payload?.typing));
      }).subscribe();
    typingChannelRef.current = channel;
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingChannelRef.current = null; setPartnerTyping(false); void supabase.removeChannel(channel); };
  }, [activeConversationId, user?.id]);

  const broadcastTyping = useCallback((typing: boolean) => {
    const channel = typingChannelRef.current;
    if (channel) void channel.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, typing } });
  }, [user?.id]);
  const handleInputChange = (value: string) => {
    setMessageInput(value); broadcastTyping(Boolean(value.trim()));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim()) typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 1400);
  };

  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      const imageMessages = messages.filter((item) => item.attachmentPath && item.attachmentType?.startsWith('image/') && !attachmentUrls[item.id]);
      if (!imageMessages.length) return;
      const pairs = await Promise.all(imageMessages.map(async (item) => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.attachmentPath!, 300);
        return !error && data?.signedUrl ? [item.id, data.signedUrl] as const : null;
      }));
      if (cancelled) return;
      setAttachmentUrls((current) => ({ ...current, ...Object.fromEntries(pairs.filter((pair): pair is readonly [string, string] => Boolean(pair))) }));
    };
    void loadPreviews();
    return () => { cancelled = true; };
  }, [messages, attachmentUrls]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, partnerTyping]);

  const openAttachment = async (message: Message, download = false) => {
    if (!message.attachmentPath) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(message.attachmentPath, 300, download ? { download: message.attachmentName || true } : {});
    if (error || !data?.signedUrl) { showToast(error?.message || 'Could not open attachment.', 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault(); const content = messageInput.trim();
    if (!activeConversationId || !content || isSending) return;
    if (content.length > 10000) { showToast('Messages cannot exceed 10,000 characters.', 'error'); return; }
    setIsSending(true); broadcastTyping(false);
    try {
      const { data, error } = await supabase.from('messages').insert({ conversation_id: activeConversationId, sender_id: user?.id, content })
        .select('id,conversation_id,sender_id,content,is_read,created_at,attachment_path,attachment_name,attachment_type,attachment_size').single();
      if (error) throw error;
      const mapped = mapDbMessage(data as DbMessage, user?.id ?? '', businessProfile?.id ?? '', activeConversation?.partnerUserId ?? '', activeConversation?.partnerBusiness?.id ?? '');
      setMessages((current) => current.some((item) => item.id === mapped.id) ? current : [...current, mapped]); setMessageInput('');
      setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, lastMessageSnippet: content, lastMessageAt: mapped.createdAt } : item).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
    } catch (error: any) { console.error('Message sending failed:', error); showToast(error.message || 'Failed to send message.', 'error'); }
    finally { setIsSending(false); }
  };

  const sendAttachment = async (file?: File) => {
    if (!file || !activeConversationId || !user?.id || isUploading) return;
    if (file.size > MAX_FILE_SIZE) { showToast('Attachments must be 10 MB or smaller.', 'error'); return; }
    if (!ALLOWED_TYPES.has(file.type)) { showToast('That file type is not supported.', 'error'); return; }
    setIsUploading(true); let uploadedPath = '';
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
      const path = `${activeConversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError; uploadedPath = uploadData.path;
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: activeConversationId, sender_id: user.id, content: file.name || 'Attachment',
        attachment_path: uploadedPath, attachment_name: file.name, attachment_type: file.type, attachment_size: file.size,
      }).select('id,conversation_id,sender_id,content,is_read,created_at,attachment_path,attachment_name,attachment_type,attachment_size').single();
      if (error) throw error;
      const mapped = mapDbMessage(data as DbMessage, user.id, businessProfile?.id ?? '', activeConversation?.partnerUserId ?? '', activeConversation?.partnerBusiness?.id ?? '');
      setMessages((current) => current.some((item) => item.id === mapped.id) ? current : [...current, mapped]);
      setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, lastMessageSnippet: `📎 ${file.name}`, lastMessageAt: mapped.createdAt } : item).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      console.error('Attachment upload failed:', error); showToast(error.message || 'Could not upload attachment.', 'error');
    } finally { setIsUploading(false); }
  };

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault(); const term = searchInput.trim();
    if (!term) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.from('messages').select('id,conversation_id,content,created_at').ilike('content', `%${term.replace(/[%_]/g, '\\$&')}%`).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setSearchResults((data ?? []).map((row: any) => ({ conversationId: row.conversation_id, messageId: row.id, content: row.content, createdAt: row.created_at })));
    } catch (error: any) { showToast(error.message || 'Message search failed.', 'error'); }
    finally { setIsSearching(false); }
  };
  const matchingConversations = useMemo(() => conversations.filter((item) => item.partnerBusiness?.businessName?.toLowerCase().includes(searchInput.trim().toLowerCase())), [conversations, searchInput]);
  const jumpToResult = async (result: {conversationId:string; messageId:string}) => {
    setActiveConversationId(result.conversationId);
    window.setTimeout(() => document.getElementById(`message-${result.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-8rem)] min-h-[480px] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><span className="text-xs font-semibold uppercase tracking-widest text-primary block">Direct Messaging</span><h1 className="text-2xl font-bold text-on-surface">Conversations</h1><p className="text-xs text-on-surface-variant mt-1">Private messaging with your connected business partners.</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void fetchConversations()} disabled={isLoadingConversations} className="rounded-xl border border-outline-variant/40 p-2.5 text-on-surface hover:bg-surface-container-low" title="Refresh conversations"><span className="material-symbols-outlined text-xl">refresh</span></button>
          <button type="button" onClick={() => onNavigate('connections')} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container"><span className="material-symbols-outlined text-lg">handshake</span>Connections</button>
        </div>
      </div>
      <form onSubmit={runSearch} className="flex gap-2">
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search businesses and message content..." className="min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary" />
        <button type="submit" disabled={isSearching || !searchInput.trim()} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-50">{isSearching ? 'Searching…' : 'Search'}</button>
        {searchInput && <button type="button" onClick={() => { setSearchInput(''); setSearchResults([]); }} className="rounded-xl border px-3 text-sm">Clear</button>}
      </form>
      {searchInput.trim() && <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm">
        <p className="mb-2 font-semibold text-on-surface">Businesses matching “{searchInput}”</p>
        {matchingConversations.length ? matchingConversations.map((item) => <button key={item.id} onClick={() => setActiveConversationId(item.id)} className="mr-2 mb-2 rounded-lg bg-surface-container-low px-3 py-2 text-left">{item.partnerBusiness?.businessName}</button>) : <p className="text-on-surface-variant">No business-name matches.</p>}
        {searchResults.length > 0 && <><p className="mt-2 mb-2 font-semibold">Message matches ({searchResults.length})</p>{searchResults.map((result) => <button key={result.messageId} onClick={() => void jumpToResult(result)} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-surface-container-low"><span className="block truncate">{result.content}</span><span className="text-xs text-on-surface-variant">{conversations.find((item) => item.id === result.conversationId)?.partnerBusiness?.businessName ?? 'Conversation'} · {formatConversationTime(result.createdAt)}</span></button>)}</>}
        {!isSearching && searchResults.length === 0 && <p className="text-xs text-on-surface-variant">Submit Search to look through message text.</p>}
      </div>}
      {loadError && <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{loadError}<button type="button" onClick={() => void fetchConversations()} className="ml-2 font-bold underline">Retry</button></div>}
      {isLoadingConversations ? <div className="flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex items-center justify-center"><div className="text-center"><span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span><p className="text-sm text-on-surface-variant mt-3">Loading your conversations...</p></div></div>
      : conversations.length === 0 ? <div className="flex-1 bg-surface-container-lowest rounded-2xl p-8 sm:p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center"><div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4"><span className="material-symbols-outlined text-3xl">forum</span></div><h3 className="text-xl font-bold text-on-surface mb-2">No conversations yet</h3><p className="text-sm text-on-surface-variant mb-6 max-w-md">Once a business connection is accepted, you can start a private conversation with that business right here.</p><button type="button" onClick={() => onNavigate('connections')} className="bg-primary px-6 py-3 rounded-xl text-sm font-semibold text-on-primary">Manage Connections</button></div>
      : <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden">
        <aside className={`${activeConversationId ? 'hidden md:flex' : 'flex'} md:col-span-4 border-r border-outline-variant/20 flex-col min-h-0 bg-surface-container-low/30`}>
          <div className="p-4 border-b border-outline-variant/20"><span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Business Partners ({conversations.length})</span></div>
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/15">{conversations.map((conversation) => {
            const name = conversation.partnerBusiness?.businessName || conversation.partnerUser?.name || 'Business Partner'; const isActive = conversation.id === activeConversationId;
            return <button key={conversation.id} type="button" onClick={() => setActiveConversationId(conversation.id)} className={`w-full text-left p-4 transition-all flex items-start gap-3 ${isActive ? 'bg-surface-container-lowest border-l-4 border-primary' : 'hover:bg-surface-container-high/40'}`}>
              <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">{getInitials(name)}</div>
              <div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><h4 className="font-bold text-sm text-on-surface truncate">{name}</h4><span className="text-[10px] text-on-surface-variant shrink-0">{formatConversationTime(conversation.lastMessageAt)}</span></div><div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs text-on-surface-variant truncate">{conversation.lastMessageSnippet}</p>{Boolean(conversation.unreadCount) && <span className="min-w-5 h-5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-on-primary flex items-center justify-center">{conversation.unreadCount! > 99 ? '99+' : conversation.unreadCount}</span>}</div></div>
            </button>;
          })}</div>
        </aside>
        <section className={`${activeConversationId ? 'flex' : 'hidden md:flex'} md:col-span-8 flex-col min-h-0`}>
          {activeConversation ? <>
            <header className="p-3 sm:p-4 border-b border-outline-variant/20 flex items-center gap-3 bg-surface-container-lowest">
              <button type="button" onClick={() => setActiveConversationId(null)} className="md:hidden rounded-lg p-2 hover:bg-surface-container-low" aria-label="Back to conversations"><span className="material-symbols-outlined">arrow_back</span></button>
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">{getInitials(activeConversation.partnerBusiness?.businessName || 'Partner')}</div>
              <div className="min-w-0 flex-1"><h3 className="font-bold text-sm text-on-surface truncate">{activeConversation.partnerBusiness?.businessName || 'Connected Business'}</h3><p className="text-xs text-on-surface-variant truncate">{partnerTyping ? <span className="text-primary">Typing…</span> : `${activeConversation.partnerBusiness?.industry || 'Business Partner'} · Connected on NJS`}</p></div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-green-600 font-semibold"><span className="w-2 h-2 rounded-full bg-green-500" />Connected</span>
            </header>
            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-surface">
              {isLoadingMessages ? <div className="h-full flex items-center justify-center"><span className="material-symbols-outlined text-2xl text-primary animate-spin">progress_activity</span></div>
              : messages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center px-4"><div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-primary"><span className="material-symbols-outlined text-2xl">waving_hand</span></div><h3 className="font-bold text-on-surface mt-4">Start the conversation</h3><p className="text-sm text-on-surface-variant mt-2 max-w-sm">Introduce your business, discuss opportunities, or simply say hello.</p></div>
              : messages.map((message) => {
                const isMe = message.senderUserId === user?.id; const isImage = Boolean(message.attachmentType?.startsWith('image/'));
                return <div id={`message-${message.id}`} key={message.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[88%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-xs leading-relaxed whitespace-pre-wrap break-words ${isMe ? 'bg-primary-container text-on-primary-container rounded-br-sm' : 'bg-surface-container-lowest text-on-surface border border-outline-variant/20 rounded-bl-sm'}`}>
                    {message.attachmentPath && <div className="mb-2 min-w-[180px]">
                      {isImage ? <button type="button" onClick={() => void openAttachment(message)} className="block text-left">{attachmentUrls[message.id] ? <img src={attachmentUrls[message.id]} alt={message.attachmentName || 'Message attachment'} className="max-h-56 max-w-full rounded-lg object-contain" /> : <span className="material-symbols-outlined text-4xl">image</span>}<span className="block text-xs underline">Open image</span></button> : <div className="flex items-center gap-2"><span className="material-symbols-outlined text-2xl">description</span><span className="min-w-0 truncate">{message.attachmentName}</span></div>}
                      <button type="button" onClick={() => void openAttachment(message, true)} className="mt-2 text-xs font-semibold underline">Download · {message.attachmentSize ? `${(message.attachmentSize / 1024 / 1024).toFixed(2)} MB` : 'File'}</button>
                    </div>}
                    {message.content && !message.attachmentPath ? message.content : message.attachmentPath ? '' : message.content}
                  </div>
                  <span className="text-[10px] text-on-surface-variant/70 mt-1 px-1">{formatMessageTime(message.createdAt)}{isMe && <> · {message.isRead ? <span className="text-primary font-semibold">Seen ✓✓</span> : 'Sent ✓'}</>}</span>
                </div>;
              })}
              {partnerTyping && <p className="text-xs text-on-surface-variant italic">{activeConversation.partnerBusiness?.businessName} is typing…</p>}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center gap-2 sm:gap-3">
              <label className={`rounded-xl border border-outline-variant/30 p-3 cursor-pointer hover:bg-surface-container-low ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Attach image or document"><span className="material-symbols-outlined text-lg">attach_file</span><input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain" disabled={isUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendAttachment(file); event.currentTarget.value = ''; }} /></label>
              <input type="text" value={messageInput} onChange={(event) => handleInputChange(event.target.value)} maxLength={10000} placeholder="Write a message..." className="flex-1 min-w-0 px-4 py-3 bg-surface rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30" />
              <button type="submit" disabled={isSending || !messageInput.trim()} className="px-4 sm:px-5 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"><span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span><span className="material-symbols-outlined text-lg">{isSending ? 'hourglass_top' : 'send'}</span></button>
              {isUploading && <span className="text-xs text-on-surface-variant">Uploading…</span>}
            </form>
          </> : <div className="h-full flex flex-col items-center justify-center text-center p-8"><span className="material-symbols-outlined text-4xl text-primary">forum</span><h3 className="font-bold text-on-surface mt-3">Select a conversation</h3><p className="text-sm text-on-surface-variant mt-1">Choose a connected business to start messaging.</p></div>}
        </section>
      </div>}
    </div>
  );
};

export default MessagesPage;
