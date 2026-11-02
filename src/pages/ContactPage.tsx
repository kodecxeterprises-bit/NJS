import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

interface SupportTicket {
  id: string;
  ticket_number: number | string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at?: string;
  last_reply_at?: string | null;
}

interface SupportReply {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_name: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

const categories = [
  { value: "general", label: "General Support" },
  { value: "account", label: "Account & Login" },
  { value: "business_profile", label: "Business Profile" },
  { value: "connections", label: "Discover & Matchmaking" },
  { value: "messaging", label: "Messages & Connections" },
  { value: "billing", label: "Billing & Subscription" },
  { value: "bug_report", label: "Report a Problem" },
  { value: "other", label: "Other Inquiry" },
];

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting for your reply",
  resolved: "Resolved",
  closed: "Closed",
};

const formatDate = (value?: string | null) => {
  if (!value) return "Just now";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
};

const statusStyle = (status: string) => {
  switch (status) {
    case "resolved":
      return "bg-emerald-500/10 text-emerald-500";
    case "closed":
      return "bg-zinc-500/10 text-zinc-400";
    case "in_progress":
      return "bg-amber-500/10 text-amber-500";
    case "waiting_on_user":
      return "bg-purple-500/10 text-purple-500";
    default:
      return "bg-blue-500/10 text-blue-500";
  }
};

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const { user, isLoading: authLoading, apiFetch } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTickets = useCallback(async () => {
    if (!user) return;

    try {
      const data = await apiFetch("/api/support/tickets");
      const rows: SupportTicket[] = data.tickets || [];

      setTickets(rows);

      return rows;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your support tickets."
      );
      return [];
    } finally {
      setLoadingTickets(false);
    }
  }, [apiFetch, user]);

  const loadConversation = useCallback(
    async (ticket: SupportTicket, silent = false) => {
      if (!user) return;

      if (!silent) {
        setLoadingConversation(true);
        setError("");
      }

      try {
        const data = await apiFetch(
          `/api/support/tickets/${encodeURIComponent(ticket.id)}`
        );

        setSelectedTicket(data.ticket || ticket);
        setReplies(data.replies || []);

        return data;
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this conversation."
          );
        }
      } finally {
        if (!silent) setLoadingConversation(false);
      }
    },
    [apiFetch, user]
  );

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;

    const initialize = async () => {
      setLoadingTickets(true);

      const rows = await loadTickets();

      if (!active || !rows) return;

      const params = new URLSearchParams(window.location.search);
      const requestedTicketId = params.get("ticket");

      const initialTicket =
        rows.find((ticket) => ticket.id === requestedTicketId) || null;

      if (initialTicket) {
        await loadConversation(initialTicket);
        if (active) setMobileConversationOpen(true);
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [authLoading, user, loadTickets, loadConversation]);

  // Refresh the inbox and open conversation while the user is viewing it.
  useEffect(() => {
    if (!user || !selectedTicket) return;

    const interval = window.setInterval(() => {
      void loadTickets();
      void loadConversation(selectedTicket, true);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [user, selectedTicket, loadTickets, loadConversation]);

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setMobileConversationOpen(true);
    setShowNewTicket(false);
    setNotice("");

    const url = new URL(window.location.href);
    url.searchParams.set("ticket", ticket.id);
    window.history.replaceState({}, "", url);

    await loadConversation(ticket);
  };

  const startNewTicket = () => {
    setSelectedTicket(null);
    setReplies([]);
    setShowNewTicket(true);
    setMobileConversationOpen(true);
    setError("");
    setNotice("");

    const url = new URL(window.location.href);
    url.searchParams.delete("ticket");
    window.history.replaceState({}, "", url);
  };

  const createTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!subject.trim() || message.trim().length < 10) {
      setError("Please provide a subject and describe your issue in at least 10 characters.");
      return;
    }

    setCreatingTicket(true);
    setError("");
    setNotice("");

    try {
      const data = await apiFetch("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          message: message.trim(),
        }),
      });

      setSubject("");
      setMessage("");
      setCategory("general");
      setShowNewTicket(false);

      const rows = await loadTickets();

      const createdTicket =
        rows?.find((ticket) => ticket.id === data.ticket?.id) ||
        rows?.find(
          (ticket) => String(ticket.ticket_number) === String(data.ticketNumber)
        );

      if (createdTicket) {
        await openTicket(createdTicket);
      } else {
        setNotice(
          `Ticket #${data.ticketNumber} was created successfully.`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your support ticket could not be created."
      );
    } finally {
      setCreatingTicket(false);
    }
  };

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTicket || !replyMessage.trim()) return;

    if (["closed", "resolved"].includes(selectedTicket.status)) {
      setError("This ticket is closed. Please create a new ticket if you need more help.");
      return;
    }

    setSendingReply(true);
    setError("");
    setNotice("");

    try {
      await apiFetch(
        `/api/support/tickets/${encodeURIComponent(selectedTicket.id)}/replies`,
        {
          method: "POST",
          body: JSON.stringify({ message: replyMessage.trim() }),
        }
      );

      setReplyMessage("");
      await loadConversation(selectedTicket);
      await loadTickets();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your reply could not be sent."
      );
    } finally {
      setSendingReply(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-on-surface-variant mt-4">
            Loading your support desk...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8">
          <span className="material-symbols-outlined text-5xl text-primary">
            support_agent
          </span>
          <h1 className="text-2xl font-bold mt-4">Sign in to contact support</h1>
          <p className="text-sm text-on-surface-variant mt-3">
            Your support tickets and conversations are saved to your account.
            Sign in to create a ticket or continue an existing conversation.
          </p>
          <button
            onClick={() => onNavigate("sign-in")}
            className="mt-6 px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          NJS Support Centre
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Your Support Desk</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Track requests and chat with the NJS support team.
            </p>
          </div>
          <button
            onClick={startNewTicket}
            className="px-4 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            <span className="material-symbols-outlined text-base align-middle mr-2">
              add
            </span>
            New ticket
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 p-3 text-sm"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 p-3 text-sm"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.7fr)] gap-4">
        <aside
          className={`bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden ${
            mobileConversationOpen ? "hidden lg:block" : "block"
          }`}
        >
          <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
            <h2 className="font-bold">Your tickets</h2>
            <span className="text-xs text-on-surface-variant">
              {tickets.length} total
            </span>
          </div>

          {loadingTickets ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                forum
              </span>
              <p className="font-semibold mt-3">No tickets yet</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Create a support ticket and your conversations will appear here.
              </p>
              <button
                onClick={startNewTicket}
                className="mt-4 text-sm text-primary font-bold"
              >
                Create your first ticket
              </button>
            </div>
          ) : (
            <div className="max-h-[650px] overflow-y-auto divide-y divide-outline-variant/20">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => void openTicket(ticket)}
                  className={`w-full text-left p-4 hover:bg-surface-container transition ${
                    selectedTicket?.id === ticket.id
                      ? "bg-primary/5 border-l-4 border-primary"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-primary">
                      #{ticket.ticket_number}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full font-semibold ${statusStyle(ticket.status)}`}
                    >
                      {statusLabels[ticket.status] || ticket.status}
                    </span>
                  </div>
                  <p className="font-semibold text-sm mt-2 line-clamp-2">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2">
                    {formatDate(ticket.last_reply_at || ticket.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section
          className={`min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden ${
            mobileConversationOpen ? "block" : "hidden lg:block"
          }`}
        >
          {showNewTicket ? (
            <div className="p-5 sm:p-7">
              <button
                onClick={() => {
                  setShowNewTicket(false);
                  setMobileConversationOpen(false);
                }}
                className="lg:hidden text-sm text-primary font-semibold mb-5"
              >
                ← Back to tickets
              </button>

              <h2 className="text-xl font-bold">Create a support ticket</h2>
              <p className="text-sm text-on-surface-variant mt-1 mb-6">
                Explain what you need help with. Our team will reply here.
              </p>

              <form onSubmit={createTicket} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Support category
                  </label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant outline-none text-sm focus:border-primary"
                  >
                    {categories.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Subject
                  </label>
                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant outline-none text-sm focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Describe your issue
                  </label>
                  <textarea
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={7}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell us what happened and how we can help..."
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-outline-variant outline-none text-sm resize-y focus:border-primary"
                  />
                  <p className="text-xs text-on-surface-variant mt-2">
                    Never include your password or sensitive payment details.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50"
                >
                  {creatingTicket ? "Creating ticket..." : "Submit support ticket"}
                </button>
              </form>
            </div>
          ) : selectedTicket ? (
            <>
              <div className="p-4 sm:p-5 border-b border-outline-variant/30">
                <button
                  onClick={() => setMobileConversationOpen(false)}
                  className="lg:hidden text-sm text-primary font-semibold mb-3"
                >
                  ← Back to tickets
                </button>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-primary font-bold">
                      TICKET #{selectedTicket.ticket_number}
                    </p>
                    <h2 className="text-lg sm:text-xl font-bold mt-1">
                      {selectedTicket.subject}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Created {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-2 rounded-full font-semibold ${statusStyle(selectedTicket.status)}`}
                  >
                    {statusLabels[selectedTicket.status] || selectedTicket.status}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-6 h-[420px] overflow-y-auto space-y-4">
                {loadingConversation ? (
                  <p className="text-center text-sm text-on-surface-variant py-10">
                    Loading conversation...
                  </p>
                ) : replies.length === 0 ? (
                  <p className="text-center text-sm text-on-surface-variant py-10">
                    No messages found for this ticket.
                  </p>
                ) : (
                  replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`flex ${reply.is_admin ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 ${
                          reply.is_admin
                            ? "bg-surface-container border border-outline-variant/30 rounded-tl-sm"
                            : "bg-primary text-on-primary rounded-tr-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-xs font-bold">
                            {reply.is_admin ? "NJS Support" : "You"}
                          </span>
                                                    <span className="text-[10px] text-on-surface-variant opacity-70">
                            {formatDate(reply.created_at)}
                          </span>
                        </div>

                        <p className="text-sm whitespace-pre-wrap break-words">
                          {reply.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {["closed", "resolved"].includes(selectedTicket.status) ? (
                <div className="p-5 border-t border-outline-variant/30 text-center">
                  <p className="text-sm text-on-surface-variant">
                    This ticket has been {selectedTicket.status}. If you still
                    need assistance, please create a new ticket.
                  </p>
                  <button
                    type="button"
                    onClick={startNewTicket}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold"
                  >
                    Create new ticket
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={sendReply}
                  className="p-4 sm:p-5 border-t border-outline-variant/30"
                >
                  <label
                    htmlFor="support-reply"
                    className="block text-sm font-semibold mb-2"
                  >
                    Your reply
                  </label>

                  <div className="flex items-end gap-2">
                    <textarea
                      id="support-reply"
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Write a message to NJS Support..."
                      rows={2}
                      maxLength={5000}
                      required
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-surface border border-outline-variant outline-none text-sm resize-y focus:border-primary"
                    />

                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="shrink-0 px-4 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50"
                    >
                      {sendingReply ? (
                        <span className="material-symbols-outlined animate-spin">
                          progress_activity
                        </span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base align-middle mr-1">
                            send
                          </span>
                          Send
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-on-surface-variant mt-2">
                    Replies are saved to this ticket and visible to the NJS
                    support team.
                  </p>
                </form>
              )}
            </>
          ) : (
            <div className="min-h-[420px] flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">
                support_agent
              </span>
              <h2 className="text-lg font-bold mt-4">
                Your support conversations
              </h2>
              <p className="text-sm text-on-surface-variant mt-2 max-w-sm">
                Select a ticket to view its conversation, or create a new
                ticket to get help from the NJS support team.
              </p>
              <button
                type="button"
                onClick={startNewTicket}
                className="mt-5 px-5 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold"
              >
                Create a support ticket
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};