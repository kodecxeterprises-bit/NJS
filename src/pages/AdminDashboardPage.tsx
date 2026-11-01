
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Section =
  | "Overview"
  | "Users"
  | "Businesses"
  | "Messages"
  | "Connections"
  | "Support Inbox"
  | "Verifications"
  | "Reports & Moderation"
  | "Discovery & Content"
  | "Analytics"
  | "Activity Logs"
  | "Security & Permissions"
  | "Platform Settings";

type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_user"
  | "resolved"
  | "closed";

type TicketPriority = "low" | "normal" | "high" | "urgent";

interface SupportReply {
  id: string;
  message: string;
  sender_id?: string | null;
  sender_name?: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  ticket_number?: string;
  subject: string;
  message?: string;
  description?: string;
  category?: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester_name?: string;
  requester_email?: string;
  company?: string;
  created_at: string;
  updated_at?: string;
  replies?: SupportReply[];
}

const sections: {
  name: Section;
  icon: string;
  group: string;
}[] = [
  { name: "Overview", icon: "dashboard", group: "MAIN" },
  { name: "Users", icon: "group", group: "MANAGEMENT" },
  { name: "Businesses", icon: "storefront", group: "MANAGEMENT" },
  { name: "Messages", icon: "forum", group: "MANAGEMENT" },
  { name: "Connections", icon: "hub", group: "MANAGEMENT" },
  { name: "Support Inbox", icon: "support_agent", group: "MANAGEMENT" },
  { name: "Verifications", icon: "verified_user", group: "MANAGEMENT" },
  { name: "Reports & Moderation", icon: "gavel", group: "SAFETY" },
  { name: "Discovery & Content", icon: "explore", group: "SAFETY" },
  { name: "Analytics", icon: "monitoring", group: "INSIGHTS" },
  { name: "Activity Logs", icon: "history", group: "INSIGHTS" },
  { name: "Security & Permissions", icon: "security", group: "SYSTEM" },
  { name: "Platform Settings", icon: "settings", group: "SYSTEM" },
];

const statusLabels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on user",
  resolved: "Resolved",
  closed: "Closed",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

const initials = (value?: string) =>
  (value || "Admin")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const statusColor = (status: TicketStatus) => {
  const colors: Record<TicketStatus, string> = {
    open: "bg-blue-500/10 text-blue-400",
    in_progress: "bg-amber-500/10 text-amber-400",
    waiting_on_user: "bg-purple-500/10 text-purple-400",
    resolved: "bg-emerald-500/10 text-emerald-400",
    closed: "bg-zinc-500/10 text-zinc-400",
  };
  return colors[status] || colors.open;
};

const priorityColor = (priority: TicketPriority) => {
  const colors: Record<TicketPriority, string> = {
    low: "text-zinc-400",
    normal: "text-blue-400",
    high: "text-orange-400",
    urgent: "text-red-400",
  };
  return colors[priority] || colors.normal;
};

export default function AdminDashboardPage() {
  const auth = useAuth() as any;
  const apiFetch = auth.apiFetch;
  const signOut = auth.signOut;
  const user = auth.user;

  const [activeSection, setActiveSection] =
    useState<Section>("Overview");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const request = useCallback(
    async (url: string, options?: RequestInit) => {
      if (apiFetch) return apiFetch(url, options);

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || "Request failed");
      }
      return data;
    },
    [apiFetch]
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query =
        statusFilter === "all"
          ? ""
          : `?status=${encodeURIComponent(statusFilter)}`;

      const data = await request(`/api/admin/support${query}`);
      const rows = Array.isArray(data)
        ? data
        : data.tickets || data.data || [];

      setTickets(rows);
      setAuthorized(true);
    } catch (err: any) {
      const message = err?.message || "Unable to load support tickets.";
      setError(message);

      if (
        message.toLowerCase().includes("admin") ||
        message.includes("403") ||
        message.includes("401")
      ) {
        setAuthorized(false);
      }
    } finally {
      setLoading(false);
    }
  }, [request, statusFilter]);

  const loadTicketDetails = useCallback(
    async (ticket: SupportTicket) => {
      setSelectedTicket(ticket);
      setTicketLoading(true);
      setReplies([]);

      try {
        const data = await request(
          `/api/admin/support?ticketId=${encodeURIComponent(ticket.id)}`
        );

        setSelectedTicket(data.ticket || ticket);
        setReplies(data.replies || data.ticket?.replies || []);
      } catch (err: any) {
        setError(err?.message || "Unable to load ticket details.");
      } finally {
        setTicketLoading(false);
      }
    },
    [request]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setSending(true);
    setError("");
    setNotice("");

    try {
      await request("/api/admin/support", {
        method: "POST",
        body: JSON.stringify({
          action: "reply",
          ticketId: selectedTicket.id,
          message: replyMessage.trim(),
        }),
      });

      setReplyMessage("");
      setNotice("Reply sent successfully.");
      await loadTicketDetails(selectedTicket);
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || "Could not send reply.");
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (
    field: "status" | "priority",
    value: string
  ) => {
    if (!selectedTicket) return;

    setError("");
    setNotice("");

    try {
      await request("/api/admin/support", {
        method: "POST",
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          [field]: value,
        }),
      });

      setSelectedTicket({
        ...selectedTicket,
        [field]: value,
      } as SupportTicket);

      setNotice("Ticket updated.");
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || "Could not update ticket.");
    }
  };

  const filteredTickets = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return tickets;

    return tickets.filter((ticket) =>
      [
        ticket.subject,
        ticket.ticket_number,
        ticket.requester_name,
        ticket.requester_email,
        ticket.company,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [tickets, search]);

  const stats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      active: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      urgent: tickets.filter((t) => t.priority === "urgent").length,
    }),
    [tickets]
  );

  const groups = [...new Set(sections.map((item) => item.group))];

  const navButton = (item: (typeof sections)[number]) => (
    <button
      key={item.name}
      onClick={() => {
        setActiveSection(item.name);
        setSidebarOpen(false);
        setSelectedTicket(null);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition ${
        activeSection === item.name
          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">
        {item.icon}
      </span>
      <span>{item.name}</span>
      {item.name === "Support Inbox" && stats.open > 0 && (
        <span className="ml-auto text-xs bg-white/15 px-2 py-0.5 rounded-full">
          {stats.open}
        </span>
      )}
    </button>
  );

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-[#14141d] border border-white/10 rounded-3xl p-8">
          <span className="material-symbols-outlined text-5xl text-red-400">
            lock
          </span>
          <h1 className="text-2xl font-bold mt-4">Access restricted</h1>
          <p className="text-zinc-400 mt-2">
            Your account does not have administrator access.
          </p>
          <button
            onClick={() => signOut?.()}
            className="mt-6 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex">
      {sidebarOpen && (
        <button
          className="fixed inset-0 bg-black/70 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 shrink-0 bg-[#101019] border-r border-white/5 flex flex-col transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xl">
              N
            </div>
            <div>
              <h1 className="font-bold text-lg">NJS Control</h1>
              <p className="text-xs text-zinc-500">Administration centre</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 px-4 mb-2">
                {group}
              </p>
              <div className="space-y-1">
                {sections
                  .filter((item) => item.group === group)
                  .map(navButton)}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold">
              {initials(user?.name || user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {user?.name || "Administrator"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {user?.email || "Admin account"}
              </p>
            </div>
            <button
              onClick={() => signOut?.()}
              title="Sign out"
              className="text-zinc-500 hover:text-red-400"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-[#09090f]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-zinc-400"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="font-semibold">{activeSection}</h2>
              <p className="text-[11px] text-zinc-500">
                NJS Platform / {activeSection}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadTickets();
                setNotice("Dashboard refreshed.");
              }}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-zinc-400">
                refresh
              </span>
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-400 hidden sm:block">
              Control centre
            </span>
          </div>
        </header>

        <div className="p-5 lg:p-8 max-w-[1600px] mx-auto">
          {error && (
            <div className="mb-5 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm flex justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError("")}>✕</button>
            </div>
          )}

          {notice && (
            <div className="mb-5 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm flex justify-between gap-3">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>✕</button>
            </div>
          )}

          {activeSection === "Overview" && (
            <div className="space-y-8">
              <div>
                <p className="text-indigo-400 text-sm font-medium">
                  PLATFORM OVERVIEW
                </p>
                <h1 className="text-3xl font-bold mt-2">
                  Welcome back, {user?.name?.split(" ")[0] || "Admin"} 👋
                </h1>
                <p className="text-zinc-500 mt-2">
                  Here's what's happening across your NJS platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: "Support tickets",
                    value: stats.total,
                    icon: "confirmation_number",
                    color: "text-indigo-400",
                  },
                  {
                    label: "Open tickets",
                    value: stats.open,
                    icon: "mark_email_unread",
                    color: "text-blue-400",
                  },
                  {
                    label: "In progress",
                    value: stats.active,
                    icon: "pending_actions",
                    color: "text-amber-400",
                  },
                  {
                    label: "Urgent tickets",
                    value: stats.urgent,
                    icon: "priority_high",
                    color: "text-red-400",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-[#14141d] border border-white/5 rounded-2xl p-5"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-zinc-500">{item.label}</p>
                      <span className={`material-symbols-outlined ${item.color}`}>
                        {item.icon}
                      </span>
                    </div>
                    <p className="text-3xl font-bold mt-4">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-[#14141d] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-lg">Recent support</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Latest customer requests
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveSection("Support Inbox")}
                      className="text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      View inbox →
                    </button>
                  </div>

                  {loading ? (
                    <p className="text-zinc-500 text-sm">Loading tickets...</p>
                  ) : tickets.length === 0 ? (
                    <p className="text-zinc-500 text-sm">
                      No support tickets found.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {tickets.slice(0, 5).map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => {
                            setActiveSection("Support Inbox");
                            loadTicketDetails(ticket);
                          }}
                          className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {ticket.subject}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {ticket.requester_name || ticket.requester_email || "Customer"}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-lg shrink-0 ${statusColor(ticket.status)}`}>
                            {statusLabels[ticket.status] || ticket.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#14141d] border border-white/5 rounded-2xl p-6">
                  <h3 className="font-semibold text-lg">Quick access</h3>
                  <p className="text-xs text-zinc-500 mt-1 mb-5">
                    Platform management shortcuts
                  </p>
                  {[
                    ["Support Inbox", "support_agent"],
                    ["Users", "group"],
                    ["Businesses", "storefront"],
                    ["Reports & Moderation", "gavel"],
                    ["Analytics", "monitoring"],
                  ].map(([name, icon]) => (
                    <button
                      key={name}
                      onClick={() => setActiveSection(name as Section)}
                      className="w-full flex items-center gap-3 py-3 border-b border-white/5 text-sm text-zinc-300 hover:text-white"
                    >
                      <span className="material-symbols-outlined text-indigo-400">
                        {icon}
                      </span>
                      {name}
                      <span className="ml-auto">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === "Support Inbox" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-indigo-400 text-sm font-medium">
                    CUSTOMER CARE
                  </p>
                  <h1 className="text-3xl font-bold mt-2">Support Inbox</h1>
                  <p className="text-zinc-500 mt-2">
                    Manage customer requests and respond to tickets.
                  </p>
                </div>
                <button
                  onClick={loadTickets}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm"
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-2">
                    refresh
                  </span>
                  Refresh tickets
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["All tickets", stats.total],
                  ["Open", stats.open],
                  ["In progress", stats.active],
                  ["Resolved", stats.resolved],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-[#14141d] border border-white/5 rounded-xl p-4"
                  >
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="text-2xl font-bold mt-2">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid xl:grid-cols-[minmax(300px,0.9fr)_minmax(400px,1.4fr)] gap-5">
                <div className="bg-[#14141d] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 space-y-3">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tickets..."
                      className="w-full bg-[#09090f] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                    />

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-[#09090f] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      <option value="all">All statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="waiting_on_user">Waiting on user</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div className="max-h-[650px] overflow-y-auto">
                    {loading ? (
                      <p className="p-6 text-sm text-zinc-500">
                        Loading tickets...
                      </p>
                    ) : filteredTickets.length === 0 ? (
                      <p className="p-6 text-sm text-zinc-500">
                        No tickets match your search.
                      </p>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => loadTicketDetails(ticket)}
                          className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/[0.04] ${
                            selectedTicket?.id === ticket.id
                              ? "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                              : ""
                          }`}
                        >
                          <div className="flex justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {ticket.subject}
                            </p>
                            <span className={`text-[10px] shrink-0 ${priorityColor(ticket.priority)}`}>
                              {priorityLabels[ticket.priority] || "Normal"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 truncate">
                            {ticket.requester_name || ticket.requester_email || "Customer"}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <span className={`text-[10px] px-2 py-1 rounded-lg ${statusColor(ticket.status)}`}>
                              {statusLabels[ticket.status] || ticket.status}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {formatDate(ticket.created_at)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-[#14141d] border border-white/5 rounded-2xl min-h-[500px] flex flex-col">
                  {!selectedTicket ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <span className="material-symbols-outlined text-5xl text-zinc-700">
                        mark_email_read
                      </span>
                      <h3 className="font-semibold mt-4">Select a ticket</h3>
                      <p className="text-sm text-zinc-500 mt-2">
                        Choose a support ticket to view its details and reply.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-5 border-b border-white/5">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-indigo-400">
                              {selectedTicket.ticket_number || selectedTicket.id}
                            </p>
                            <h3 className="font-bold text-lg mt-1 break-words">
                              {selectedTicket.subject}
                            </h3>
                          </div>
                          <button
                            onClick={() => setSelectedTicket(null)}
                            className="text-zinc-500 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 mt-5">
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase">
                              Status
                            </label>
                            <select
                              value={selectedTicket.status}
                              onChange={(e) =>
                                updateTicket("status", e.target.value)
                              }
                              className="mt-1 w-full bg-[#09090f] border border-white/10 rounded-lg p-2 text-xs"
                            >
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase">
                              Priority
                            </label>
                            <select
                              value={selectedTicket.priority}
                              onChange={(e) =>
                                updateTicket("priority", e.target.value)
                              }
                              className="mt-1 w-full bg-[#09090f] border border-white/10 rounded-lg p-2 text-xs"
                            >
                              {Object.entries(priorityLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
                          <div>
                            <p className="text-zinc-600">Requester</p>
                            <p className="text-zinc-300 mt-1">
                              {selectedTicket.requester_name || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-600">Email</p>
                            <p className="text-zinc-300 mt-1 break-all">
                              {selectedTicket.requester_email || "Not provided"}
    
                              {selectedTicket.requester_email || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-600">Category</p>
                            <p className="text-zinc-300 mt-1">
                              {selectedTicket.category || "General"}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-600">Created</p>
                            <p className="text-zinc-300 mt-1">
                              {formatDate(selectedTicket.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[450px]">
                        <div className="p-4 rounded-xl bg-white/[0.04]">
                          <p className="text-xs text-indigo-400 mb-2">
                            Original request
                          </p>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                            {selectedTicket.message ||
                              selectedTicket.description ||
                              "No message provided."}
                          </p>
                        </div>

                        {ticketLoading ? (
                          <p className="text-sm text-zinc-500">
                            Loading conversation...
                          </p>
                        ) : replies.length === 0 ? (
                          <p className="text-xs text-zinc-600 text-center py-4">
                            No replies yet.
                          </p>
                        ) : (
                          replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/10"
                            >
                              <div className="flex justify-between gap-3 mb-2">
                                <p className="text-xs font-semibold text-indigo-300">
                                  {reply.sender_name || "Support team"}
                                </p>
                                <p className="text-[10px] text-zinc-600">
                                  {formatDate(reply.created_at)}
                                </p>
                              </div>
                              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                                {reply.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-4 border-t border-white/5">
                        <textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          rows={3}
                          placeholder="Write a reply to the customer..."
                          className="w-full bg-[#09090f] border border-white/10 rounded-xl p-3 text-sm resize-y outline-none focus:border-indigo-500"
                        />
                        <div className="flex justify-end mt-3">
                          <button
                            disabled={sending || !replyMessage.trim()}
                            onClick={sendReply}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium"
                          >
                            {sending ? "Sending..." : "Send reply"}
                            <span className="material-symbols-outlined text-sm ml-2 align-middle">
                              send
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection !== "Overview" &&
            activeSection !== "Support Inbox" && (
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="max-w-lg text-center bg-[#14141d] border border-white/5 rounded-3xl p-8">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl">
                      {sections.find((item) => item.name === activeSection)?.icon}
                    </span>
                  </div>
                  <p className="text-indigo-400 text-xs tracking-widest font-semibold mt-6">
                    ADMIN MODULE
                  </p>
                  <h2 className="text-2xl font-bold mt-2">
                    {activeSection}
                  </h2>
                  <p className="text-zinc-500 text-sm leading-6 mt-3">
                    This module is part of the NJS administration system.
                    Its interface and backend integration will be implemented
                    in the next development phase.
                  </p>
                  <button
                    onClick={() => setActiveSection("Overview")}
                    className="mt-6 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm"
                  >
                    Back to overview
                  </button>
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
