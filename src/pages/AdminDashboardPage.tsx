
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Section =
  | "Overview" | "Users" | "Businesses" | "Messages" | "Connections"
  | "Support Inbox" | "Verifications" | "Reports & Moderation"
  | "Discovery & Content" | "Analytics" | "Activity Logs"
  | "Security & Permissions" | "Platform Settings";

type TicketStatus = "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "high" | "urgent";

interface Ticket {
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
}

interface Reply {
  id: string;
  message: string;
  sender_id?: string | null;
  sender_name?: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  createdAt: string;
  lastSignInAt?: string | null;
  emailConfirmed: boolean;
  suspended: boolean;
  bannedUntil?: string | null;
  isAdmin: boolean;
}

interface Business {
  id: string;
  owner_id: string;
  business_name: string;
  business_type: string;
  industry: string;
  country: string;
  city: string;
  website?: string;
  phone?: string;
  business_description?: string;
  onboarding_completed: boolean;
  is_verified: boolean;
  created_at: string;
  ownerName?: string;
}

interface OverviewStats {
  users: number;
  businesses: number;
  verifiedBusinesses: number;
  unverifiedBusinesses: number;
  connections: number;
  conversations: number;
  messages: number;
  supportTickets: number;
  activeSupportTickets: number;
}

const sections: { name: Section; icon: string; group: string }[] = [
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

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";

const initials = (value?: string) =>
  (value || "Admin").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const statusColor = (status: TicketStatus) => ({
  open: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  waiting_on_user: "bg-purple-500/10 text-purple-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  closed: "bg-zinc-500/10 text-zinc-400",
}[status] || "bg-zinc-500/10 text-zinc-400");

const priorityColor = (priority: TicketPriority) => ({
  low: "text-zinc-400",
  normal: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
}[priority] || "text-zinc-400");

const emptyStats: OverviewStats = {
  users: 0,
  businesses: 0,
  verifiedBusinesses: 0,
  unverifiedBusinesses: 0,
  connections: 0,
  conversations: 0,
  messages: 0,
  supportTickets: 0,
  activeSupportTickets: 0,
};

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
}

export default function AdminDashboardPage({
  onNavigate,
}: AdminDashboardPageProps) {
  const auth = useAuth() as any;
  const apiFetch = auth.apiFetch;
  const signOut = auth.signOut;
  const user = auth.user;

  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [stats, setStats] = useState<OverviewStats>(emptyStats);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyMessage, setReplyMessage] = useState("");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [businessPage, setBusinessPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (url: string, options?: RequestInit) => {
    if (apiFetch) return apiFetch(url, options);

    throw new Error("Your authenticated API connection is unavailable.");
  }, [apiFetch]);

  const handleError = (err: any) => {
    const message = err?.message || "Something went wrong.";
    setError(message);

    if (
      message.toLowerCase().includes("admin") ||
      message.includes("403") ||
      message.includes("401")
    ) {
      setAuthorized(false);
    }
  };

  const loadOverview = useCallback(async () => {
    const data = await request("/api/admin/overview");
    if (data.stats) setStats({ ...emptyStats, ...data.stats });
    setAuthorized(true);
  }, [request]);

  const loadTickets = useCallback(async () => {
    const query = statusFilter === "all"
      ? ""
      : `?status=${encodeURIComponent(statusFilter)}`;

    const data = await request(`/api/admin/support${query}`);
    const rows = Array.isArray(data) ? data : data.tickets || data.data || [];
    setTickets(rows);
    setAuthorized(true);
  }, [request, statusFilter]);

  const loadUsers = useCallback(async () => {
    const query = new URLSearchParams({
      search: userSearch,
      page: String(userPage),
      limit: "20",
    });
    const data = await request(`/api/admin/users?${query}`);
    setUsers(data.users || []);
    setAuthorized(true);
  }, [request, userSearch, userPage]);

  const loadBusinesses = useCallback(async () => {
    const query = new URLSearchParams({
      search: businessSearch,
      page: String(businessPage),
      limit: "20",
    });
    const data = await request(`/api/admin/businesses?${query}`);
    setBusinesses(data.businesses || []);
    setAuthorized(true);
  }, [request, businessSearch, businessPage]);

  const refreshCurrent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (activeSection === "Overview") {
        await Promise.all([loadOverview(), loadTickets()]);
      } else if (activeSection === "Users") {
        await loadUsers();
      } else if (activeSection === "Businesses" || activeSection === "Verifications") {
        await loadBusinesses();
      } else if (activeSection === "Support Inbox") {
        await loadTickets();
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [activeSection, loadOverview, loadTickets, loadUsers, loadBusinesses]);

  useEffect(() => {
    refreshCurrent();
  }, [refreshCurrent]);

  const loadTicketDetails = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setTicketLoading(true);
    setReplies([]);
    setError("");

    try {
      const data = await request(
        `/api/admin/support?ticketId=${encodeURIComponent(ticket.id)}`
      );
      setSelectedTicket(data.ticket || ticket);
      setReplies(data.replies || data.ticket?.replies || []);
    } catch (err) {
      handleError(err);
    } finally {
      setTicketLoading(false);
    }
  };

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
    } catch (err) {
      handleError(err);
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (field: "status" | "priority", value: string) => {
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
      setSelectedTicket({ ...selectedTicket, [field]: value } as Ticket);
      setNotice("Ticket updated.");
      await loadTickets();
    } catch (err) {
      handleError(err);
    }
  };

  const updateUser = async (target: AdminUser, action: "suspend" | "restore") => {
    if (target.isAdmin) {
      setError("Administrator accounts cannot be suspended here.");
      return;
    }

    let duration = "72h";
    if (action === "suspend") {
      const selected = window.prompt(
        "Enter suspension duration: 24h, 72h, or 168h (7 days).",
        "72h"
      );
      if (!selected) return;
      if (!["24h", "72h", "168h"].includes(selected)) {
        setError("Please enter 24h, 72h, or 168h.");
        return;
      }
      duration = selected;
      if (!window.confirm(`Suspend ${target.email} for ${duration}?`)) return;
    } else if (!window.confirm(`Restore access for ${target.email}?`)) {
      return;
    }

    setActionLoading(target.id);
    setError("");
    setNotice("");

    try {
      const data = await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          userId: target.id,
          action,
          duration,
        }),
      });
      setNotice(data.message || "User updated.");
      await loadUsers();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading("");
    }
  };

  const updateBusiness = async (business: Business, action: "verify" | "unverify") => {
    const verb = action === "verify" ? "verify" : "remove verification from";
    if (!window.confirm(`Are you sure you want to ${verb} ${business.business_name}?`)) return;

    setActionLoading(business.id);
    setError("");
    setNotice("");

    try {
      const data = await request("/api/admin/businesses", {
        method: "POST",
        body: JSON.stringify({ businessId: business.id, action }),
      });
      setNotice(data.message || "Business updated.");
      await loadBusinesses();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading("");
    }
  };

  const filteredTickets = useMemo(() => {
    const term = ticketSearch.toLowerCase().trim();
    if (!term) return tickets;
    return tickets.filter((ticket) =>
      [
        ticket.subject,
        ticket.ticket_number,
        ticket.requester_name,
        ticket.requester_email,
        ticket.company,
      ].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(term)
      )
    );
  }, [tickets, ticketSearch]);

  const ticketStats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    active: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    urgent: tickets.filter((t) => t.priority === "urgent").length,
  }), [tickets]);

  const groups = [...new Set(sections.map((item) => item.group))];

  const navigate = (name: Section) => {
    setActiveSection(name);
    setSidebarOpen(false);
    setSelectedTicket(null);
    setError("");
    setNotice("");
  };

  const navButton = (item: (typeof sections)[number]) => (
    <button
      key={item.name}
      onClick={() => navigate(item.name)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition ${
        activeSection === item.name
          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      <span>{item.name}</span>
      {item.name === "Support Inbox" && ticketStats.open > 0 && (
        <span className="ml-auto text-xs bg-white/15 px-2 py-0.5 rounded-full">
          {ticketStats.open}
        </span>
      )}
    </button>
  );

  const StatCard = ({ label, value, icon, color = "text-indigo-400" }: {
    label: string; value: number; icon: string; color?: string;
  }) => (
    <div className="bg-[#14141d] border border-white/5 rounded-2xl p-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-zinc-500">{label}</p>
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold mt-4">{value.toLocaleString()}</p>
    </div>
  );

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-[#14141d] border border-white/10 rounded-3xl p-8">
          <span className="material-symbols-outlined text-5xl text-red-400">lock</span>
          <h1 className="text-2xl font-bold mt-4">Access restricted</h1>
          <p className="text-zinc-400 mt-2">
            Your account does not have administrator access.
          </p>
          <button onClick={() => signOut?.()} className="mt-6 px-5 py-3 rounded-xl bg-indigo-600">
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

      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 shrink-0 bg-[#101019] border-r border-white/5 flex flex-col transition-transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xl">N</div>
            <div>
              <h1 className="font-bold text-lg">NJS Control</h1>
              <p className="text-xs text-zinc-500">Administration centre</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 px-4 mb-2">{group}</p>
              <div className="space-y-1">
                {sections.filter((item) => item.group === group).map(navButton)}
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
              <p className="text-sm font-medium truncate">{user?.name || "Administrator"}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email || "Admin account"}</p>
            </div>
            <button onClick={() => signOut?.()} title="Sign out" className="text-zinc-500 hover:text-red-400">
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        
<header className="sticky top-0 z-20 min-h-16 bg-[#09090f]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-8 py-2">
  <div className="flex items-center gap-3 min-w-0">
    <button
      className="lg:hidden text-zinc-400 shrink-0"
      onClick={() => setSidebarOpen(true)}
      aria-label="Open navigation"
    >
      <span className="material-symbols-outlined">menu</span>
    </button>

    <div className="min-w-0">
      <h2 className="font-semibold truncate">{activeSection}</h2>
      <p className="text-[11px] text-zinc-500 truncate">
        NJS Platform / {activeSection}
      </p>
    </div>
  </div>

  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
    <button
      onClick={() => onNavigate("dashboard")}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-sm transition-colors"
      title="Return to NJS"
    >
      <span className="material-symbols-outlined text-lg">arrow_back</span>
      <span className="hidden sm:inline">Back to NJS</span>
    </button>

    <button
      onClick={refreshCurrent}
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

          <div className="flex items-center gap-3">
            <button className="lg:hidden text-zinc-400" onClick={() => setSidebarOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="font-semibold">{activeSection}</h2>
              <p className="text-[11px] text-zinc-500">NJS Platform / {activeSection}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refreshCurrent} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center" title="Refresh">
              <span className="material-symbols-outlined text-zinc-400">refresh</span>
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-400 hidden sm:block">Control centre</span>
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

          {loading && (
            <p className="text-sm text-zinc-500 mb-4">Loading live platform data...</p>
          )}

          {activeSection === "Overview" && (
            <div className="space-y-8">
              <div>
                <p className="text-indigo-400 text-sm font-medium">PLATFORM OVERVIEW</p>
                <h1 className="text-3xl font-bold mt-2">Welcome back, {user?.name?.split(" ")[0] || "Admin"} 👋</h1>
                <p className="text-zinc-500 mt-2">Live statistics from your NJS platform.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total users" value={stats.users} icon="group" />
                <StatCard label="Businesses" value={stats.businesses} icon="storefront" color="text-cyan-400" />
                <StatCard label="Verified businesses" value={stats.verifiedBusinesses} icon="verified" color="text-emerald-400" />
                <StatCard label="Unverified businesses" value={stats.unverifiedBusinesses} icon="pending" color="text-amber-400" />
                <StatCard label="Connections" value={stats.connections} icon="hub" />
                <StatCard label="Conversations" value={stats.conversations} icon="forum" />
                <StatCard label="Messages" value={stats.messages} icon="mail" />
                <StatCard label="Active support tickets" value={stats.activeSupportTickets} icon="support_agent" color="text-orange-400" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="bg-[#14141d] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold">Recent support tickets</h3>
                    <button onClick={() => navigate("Support Inbox")} className="text-sm text-indigo-400 hover:text-indigo-300">
                      View all
                    </button>
                  </div>
                  {tickets.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-6 text-center">No support tickets yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {tickets.slice(0, 5).map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => {
                            navigate("Support Inbox");
                            loadTicketDetails(ticket);
                          }}
                          className="w-full text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm truncate">{ticket.subject}</span>
                            <span className={`text-xs shrink-0 ${statusColor(ticket.status)}`}>
                              {statusLabels[ticket.status] || ticket.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {ticket.requester_name || ticket.requester_email || "Unknown requester"} · {formatDate(ticket.created_at)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-[#14141d] border border-white/5 rounded-2xl p-5">
                  <h3 className="font-semibold mb-5">Platform activity</h3>
                  <div className="space-y-4">
                    {[
                      ["Total users", stats.users, "group"],
                      ["Business profiles", stats.businesses, "storefront"],
                      ["Total connections", stats.connections, "hub"],
                      ["Messages sent", stats.messages, "mail"],
                      ["Support tickets", stats.supportTickets, "support_agent"],
                    ].map(([label, value, icon]) => (
                      <div key={String(label)} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-zinc-400">
                          <span className="material-symbols-outlined text-zinc-500">{String(icon)}</span>
                          {String(label)}
                        </div>
                        <span className="font-semibold">{Number(value).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeSection === "Users" && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">User management</h1>
                  <p className="text-sm text-zinc-500 mt-1">Search accounts and temporarily suspend or restore access.</p>
                </div>
                <input
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search name or email..."
                  className="w-full sm:max-w-sm bg-[#14141d] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-[#14141d] border border-white/5 rounded-2xl overflow-hidden">
                {users.length === 0 ? (
                  <p className="p-8 text-center text-sm text-zinc-500">No users found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-zinc-500 bg-white/[0.02]">
                        <tr>
                          <th className="text-left p-4">User</th>
                          <th className="text-left p-4">Joined</th>
                          <th className="text-left p-4">Last sign-in</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((target) => (
                          <tr key={target.id} className="border-t border-white/5">
                            <td className="p-4">
                              <div className="flex items-center gap-3 min-w-56">
                                {target.avatar ? (
                                  <img src={target.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                                    {initials(target.name || target.email)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{target.name || "Unnamed user"}</p>
                                  <p className="text-xs text-zinc-500 truncate">{target.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-zinc-400 whitespace-nowrap">{formatDate(target.createdAt)}</td>
                            <td className="p-4 text-zinc-400 whitespace-nowrap">{formatDate(target.lastSignInAt || undefined)}</td>
                            <td className="p-4">
                              {target.isAdmin ? (
                                <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full">Admin</span>
                              ) : target.suspended ? (
                                <span className="text-xs text-red-300 bg-red-500/10 px-2 py-1 rounded-full">Suspended</span>
                              ) : (
                                <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">Active</span>
                              )}
                              {!target.emailConfirmed && (
                                <span className="block text-xs text-amber-400 mt-1">Email unconfirmed</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {target.isAdmin ? (
                                <span className="text-xs text-zinc-600">Protected</span>
                              ) : (
                                <button
                                  disabled={actionLoading === target.id}
                                  onClick={() => updateUser(target, target.suspended ? "restore" : "suspend")}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 ${
                                    target.suspended
                                      ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                      : "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                  }`}
                                >
                                  {actionLoading === target.id ? "Please wait..." : target.suspended ? "Restore" : "Suspend"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  className="px-4 py-2 rounded-lg bg-white/5 text-sm disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500">Page {userPage}</span>
                <button
                  disabled={users.length < 20}
                  onClick={() => setUserPage((page) => page + 1)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-sm disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </section>
          )}

          {(activeSection === "Businesses" || activeSection === "Verifications") && (
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">
                    {activeSection === "Verifications" ? "Business verifications" : "Business management"}
                  </h1>
                  <p className="text-sm text-zinc-500 mt-1">Review business profiles and manage verification status.</p>
                </div>
                <input
                  value={businessSearch}
                  onChange={(event) => {
                    setBusinessSearch(event.target.value);
                    setBusinessPage(1);
                  }}
                  placeholder="Search businesses..."
                  className="w-full sm:max-w-sm bg-[#14141d] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-[#14141d] border border-white/5 rounded-2xl overflow-hidden">
                {businesses.length === 0 ? (
                  <p className="p-8 text-center text-sm text-zinc-500">No businesses found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-zinc-500 bg-white/[0.02]">
                        <tr>
                          <th className="text-left p-4">Business</th>
                          <th className="text-left p-4">Location</th>
                          <th className="text-left p-4">Owner</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {businesses.map((business) => (
                          <tr key={business.id} className="border-t border-white/5">
                            <td className="p-4 min-w-52">
                              <p className="font-medium">{business.business_name}</p>
                              <p className="text-xs text-zinc-500 mt-1">{business.business_type || business.industry || "Business"}</p>
                              {business.website && (
                                <a href={business.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">
                                  Visit website
                                </a>
                              )}
                            </td>
                            <td className="p-4 text-zinc-400 whitespace-nowrap">
                              {[business.city, business.country].filter(Boolean).join(", ") || "—"}
                            </td>
                            <td className="p-4 text-zinc-400">{business.ownerName || "—"}</td>
                            <td className="p-4">
                              {business.is_verified ? (
                                <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">Verified</span>
                              ) : (
                                <span className="text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded-full">Unverified</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                disabled={actionLoading === business.id}
                                onClick={() => updateBusiness(business, business.is_verified ? "unverify" : "verify")}
                                className={`px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 ${
                                  business.is_verified
                                    ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                }`}
                              >
                                {actionLoading === business.id ? "Please wait..." : business.is_verified ? "Remove verification" : "Verify business"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  disabled={businessPage <= 1}
                  onClick={() => setBusinessPage((page) => Math.max(1, page - 1))}
                  className="px-4 py-2 rounded-lg bg-white/5 text-sm disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500">Page {businessPage}</span>
                <button
                  disabled={businesses.length < 20}
                  onClick={() => setBusinessPage((page) => page + 1)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-sm disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </section>
          )}

          {activeSection === "Support Inbox" && (
            <section className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold">Support inbox</h1>
                <p className="text-sm text-zinc-500 mt-1">Review tickets, reply to users and manage support status.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Total", ticketStats.total],
                  ["Open", ticketStats.open],
                  ["In progress", ticketStats.active],
                  ["Urgent", ticketStats.urgent],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-[#14141d] border border-white/5 rounded-xl p-4">
                    <p className="text-xs text-zinc-500">{String(label)}</p>
                    <p className="text-2xl font-bold mt-2">{Number(value)}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={ticketSearch}
                  onChange={(event) => setTicketSearch(event.target.value)}
                  placeholder="Search tickets..."
                  className="flex-1 bg-[#14141d] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="bg-[#14141d] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting_on_user">Waiting on user</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)] gap-5">
                <div className="bg-[#14141d] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-semibold">Tickets</h3>
                    <span className="text-xs text-zinc-500">{filteredTickets.length} found</span>
                  </div>
                  <div className="max-h-[650px] overflow-y-auto divide-y divide-white/5">
                    {filteredTickets.length === 0 ? (
                      <p className="p-8 text-center text-sm text-zinc-500">No tickets match this filter.</p>
                    ) : filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => loadTicketDetails(ticket)}
                        className={`w-full text-left p-4 hover:bg-white/[0.04] ${
                          selectedTicket?.id === ticket.id ? "bg-indigo-500/10 border-l-2 border-indigo-400" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{ticket.subject}</span>
                          <span className={`text-[11px] shrink-0 ${priorityColor(ticket.priority)}`}>
                            {priorityLabels[ticket.priority] || ticket.priority}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2 truncate">
                          {ticket.requester_name || ticket.requester_email || "Unknown requester"}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className={`text-[11px] px-2 py-1 rounded-full ${statusColor(ticket.status)}`}>
                            {statusLabels[ticket.status] || ticket.status}
                          </span>
                          <span className="text-[10px] text-zinc-600">{formatDate(ticket.created_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#14141d] border border-white/5 rounded-2xl min-h-[450px] flex flex-col">
                  {!selectedTicket ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <span className="material-symbols-outlined text-5xl text-zinc-700">mark_email_unread</span>
                      <h3 className="font-semibold mt-3">Select a support ticket</h3>
                      <p className="text-sm text-zinc-500 mt-1">Ticket details and replies will appear here.</p>
                    </div>
                  ) : (
                     <>
                      <div className="p-5 border-b border-white/5">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs text-indigo-400">
                              {selectedTicket.ticket_number || `Ticket ${selectedTicket.id.slice(0, 8)}`}
                            </p>
                            <h3 className="text-lg font-semibold mt-1">{selectedTicket.subject}</h3>
                            <p className="text-xs text-zinc-500 mt-2">
                              {selectedTicket.requester_name || "User"} · {selectedTicket.requester_email || "No email"} · {formatDate(selectedTicket.created_at)}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <select
                              value={selectedTicket.status}
                              onChange={(event) => updateTicket("status", event.target.value)}
                              className="bg-[#09090f] border border-white/10 rounded-lg px-3 py-2 text-xs"
                            >
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>

                            <select
                              value={selectedTicket.priority}
                              onChange={(event) => updateTicket("priority", event.target.value)}
                              className="bg-[#09090f] border border-white/10 rounded-lg px-3 py-2 text-xs"
                            >
                              {Object.entries(priorityLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 border-b border-white/5">
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                          Original message
                        </p>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                          {selectedTicket.message || selectedTicket.description || "No message provided."}
                        </p>
                      </div>

                      <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[350px]">
                        <h4 className="text-xs uppercase tracking-wider text-zinc-500">
                          Conversation
                        </h4>

                        {ticketLoading ? (
                          <p className="text-sm text-zinc-500">Loading replies...</p>
                        ) : replies.length === 0 ? (
                          <p className="text-sm text-zinc-500">No replies yet.</p>
                        ) : (
                          replies.map((reply) => (
                            <div key={reply.id} className="p-3 rounded-xl bg-white/[0.04]">
                              <div className="flex justify-between gap-3">
                                <span className="text-xs font-semibold">
                                  {reply.sender_name || "Support team"}
                                </span>
                                <span className="text-[10px] text-zinc-600">
                                  {formatDate(reply.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">
                                {reply.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-5 border-t border-white/5">
                        <textarea
                          value={replyMessage}
                          onChange={(event) => setReplyMessage(event.target.value)}
                          rows={3}
                          placeholder="Write a reply to this user..."
                          className="w-full bg-[#09090f] border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 resize-y"
                        />

                        <div className="flex justify-end mt-3">
                          <button
                            onClick={sendReply}
                            disabled={sending || !replyMessage.trim()}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-40"
                          >
                            {sending ? "Sending..." : "Send reply"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {![
            "Overview",
            "Users",
            "Businesses",
            "Verifications",
            "Support Inbox",
          ].includes(activeSection) && (
            <section className="bg-[#14141d] border border-white/5 rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-zinc-700">
                construction
              </span>
              <h2 className="text-xl font-bold mt-4">{activeSection}</h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-lg mx-auto">
                This section is reserved for the next administration module.
                Its interface will be connected when the corresponding backend
                tools are implemented.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}