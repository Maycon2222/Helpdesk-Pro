import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CheckCircle2, CircleUserRound, Clock, Loader2, LogIn, LogOut, MessageSquare, Plus, Search, Shield, SlidersHorizontal, Sparkles, TicketIcon, UserCheck, UserPlus, Users, Zap } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { api, unwrap } from "./api";
import { useAuthStore } from "./store";
import { Comment, HistoryEvent, Priority, Role, Status, Ticket, User } from "./types";

const statusLabels: Record<Status, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting: "Aguardando resposta",
  resolved: "Resolvido",
  cancelled: "Cancelado"
};

const priorityLabels: Record<Priority, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente"
};

const categories = ["Infraestrutura", "Software", "Hardware", "Acesso e permissões", "Solicitação de serviço", "Outros"];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={cx("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset ring-black/5", tone)}>{children}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const tones: Record<Status, string> = {
    open: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    waiting: "bg-purple-100 text-purple-800",
    resolved: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-500"
  };
  return <Badge tone={tones[status]}>{statusLabels[status]}</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const tones: Record<Priority, string> = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800"
  };
  return <Badge tone={tones[priority]}>{priority === "urgent" ? "! " : ""}{priorityLabels[priority]}</Badge>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";

function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        "group relative min-h-10 overflow-hidden rounded-md px-4 py-2 text-sm font-bold shadow-sm transition-all duration-200 ease-out",
        "inline-flex w-full items-center justify-center gap-2 sm:w-auto",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 active:translate-y-0 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-60",
        variant === "primary" && "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-indigo-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-200 focus:ring-indigo-500",
        variant === "secondary" && "border border-indigo-100 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-lg hover:shadow-indigo-100 focus:ring-indigo-500",
        variant === "danger" && "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-100 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-200 focus:ring-red-500",
        variant === "ghost" && "bg-transparent text-gray-600 shadow-none hover:bg-white/80 hover:text-gray-950 hover:shadow-sm focus:ring-gray-400",
        variant === "success" && "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-100 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-200 focus:ring-emerald-500",
        props.className
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative inline-flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {children}
      </span>
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all duration-200 focus:-translate-y-0.5 focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-100 focus:ring-2 focus:ring-indigo-100", props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx("w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all duration-200 focus:-translate-y-0.5 focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-100 focus:ring-2 focus:ring-indigo-100", props.className)} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all duration-200 focus:-translate-y-0.5 focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-100 focus:ring-2 focus:ring-indigo-100", props.className)} />;
}

function useToast() {
  const [message, setMessage] = useState("");
  function showToast(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2600);
  }
  const toast = message ? <Toast message={message} /> : null;
  return { toast, showToast };
}

function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-bold text-emerald-800 shadow-2xl shadow-emerald-100 backdrop-blur animate-pop-in">
      <CheckCircle2 size={18} />
      {message}
    </div>
  );
}

function Protected({ children }: { children: React.ReactElement }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
}

function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "attendant"] },
    { to: "/tickets", label: user?.role === "requester" ? "Meus Chamados" : "Todos os Chamados", icon: TicketIcon, roles: ["admin", "attendant", "requester"] },
    { to: "/admin/users", label: "Gerenciar Usuários", icon: Users, roles: ["admin"] }
  ];

  return (
    <div className="app-surface min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/70 bg-white/80 shadow-2xl shadow-indigo-100/60 backdrop-blur-xl lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-indigo-50 p-6">
            <div className="flex items-center gap-3">
              <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Shield size={22} />
              </div>
              <div>
                <div className="text-lg font-extrabold text-gray-950">HelpDesk Pro</div>
                <div className="text-xs font-medium text-gray-500">Gestão de chamados</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-2 p-4">
            {navItems.filter((item) => item.roles.includes(user?.role || "requester")).map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
              <Link key={item.to} to={item.to} className={cx("nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition", active ? "active bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-700")}>
                <item.icon size={18} />
                {item.label}
              </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-white/70 bg-white/80 px-4 py-3 shadow-sm shadow-indigo-100/50 backdrop-blur-xl lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate text-sm font-bold text-gray-900"><Bell size={15} className="text-indigo-500" />{user?.name}</div>
              <div className="text-xs text-gray-500">Perfil: {user?.role}</div>
            </div>
            <Button
              variant="ghost"
              className="w-auto px-3"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut size={16} /> Sair
            </Button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.filter((item) => item.roles.includes(user?.role || "requester")).map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
              <Link key={item.to} to={item.to} className={cx("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold shadow-sm transition-all", active ? "border-indigo-500 bg-indigo-600 text-white shadow-indigo-200" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700")}>
                <item.icon size={16} />
                {item.label}
              </Link>
              );
            })}
          </nav>
        </header>
        <div className="px-4 py-6 lg:px-8">
          <Routes>
            <Route path="/dashboard" element={user?.role === "requester" ? <Navigate to="/tickets" replace /> : <DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/admin/users" element={user?.role === "admin" ? <UsersPage /> : <Navigate to="/tickets" replace />} />
            <Route path="*" element={<Navigate to={user?.role === "requester" ? "/tickets" : "/dashboard"} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("admin@helpdeskpro.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  if (token) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = unwrap<{ access_token: string; user: User }>(await api.post("/auth/login", { email, password }));
      setAuth(data.access_token, data.user);
      navigate(data.user.role === "requester" ? "/tickets" : "/dashboard");
    } catch {
      setError("Credenciais inválidas ou API indisponível.");
    } finally {
      setLoading(false);
    }
  }

  const demo = [
    ["Admin", "admin@helpdeskpro.com", "admin123"],
    ["Atendente", "carlos@helpdeskpro.com", "atend123"],
    ["Solicitante", "joao@helpdeskpro.com", "user123"]
  ];

  return (
    <div className="login-surface flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#4f46e588,transparent_34%),radial-gradient(circle_at_bottom_right,#06b6d466,transparent_30%),linear-gradient(135deg,#111827,#020617)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_430px]">
        <section className="hero-panel flex min-h-[460px] flex-col justify-end rounded-lg border border-white/10 bg-white/8 p-8 text-white shadow-2xl backdrop-blur">
          <div className="brand-mark mb-16 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-500">
            <TicketIcon size={28} />
          </div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight">HelpDesk Pro</h1>
          <p className="mt-4 max-w-xl text-base text-indigo-100">Gestão de chamados internos com SLA, histórico, comentários e controle de permissões por perfil.</p>
        </section>
        <form onSubmit={submit} className="rounded-lg bg-white/95 p-6 shadow-2xl shadow-indigo-950/30 backdrop-blur">
          <h2 className="text-2xl font-extrabold text-gray-950">Entrar</h2>
          <p className="mt-1 text-sm text-gray-500">Acesse com uma conta de demonstração.</p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1" /></label>
            <label className="block text-sm font-semibold text-gray-700">Senha<Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1" /></label>
            {error && <div className="animate-pop-in rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
            <Button busy={loading} className="w-full">
              {!loading && <LogIn size={16} />}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </div>
          <details className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40">
            <summary className="cursor-pointer text-sm font-bold text-gray-800">Credenciais de demonstração</summary>
            <div className="mt-3 space-y-2">
              {demo.map(([role, mail, pass]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword(pass); }} className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-xs transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-md">
                  <span className="font-bold text-gray-700">{role}</span>
                  <span className="text-gray-500">{mail} / {pass}</span>
                </button>
              ))}
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}

function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  useEffect(() => { api.get("/dashboard/metrics").then((r) => setMetrics(unwrap<any>(r))); }, []);
  if (!metrics) return <Skeleton title="Carregando dashboard" />;
  const cards = [
    ["Abertos", metrics.total_open, TicketIcon, "text-blue-700 bg-blue-50"],
    ["Em atendimento", metrics.in_progress, Clock, "text-amber-700 bg-amber-50"],
    ["Atrasados", metrics.overdue, AlertTriangle, "text-red-700 bg-red-50"],
    ["Resolvidos hoje", metrics.resolved_today, CheckCircle2, "text-green-700 bg-green-50"]
  ];
  return (
    <div className="space-y-6">
      <PageTitle title="Dashboard" action={<Link to="/tickets/new"><Button><Plus size={16} /> Novo Chamado</Button></Link>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone]: any) => (
          <div key={label} className="metric-card rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className={cx("mb-4 flex h-11 w-11 items-center justify-center rounded-md", tone)}><Icon size={20} /></div>
            <div className="text-3xl font-extrabold text-gray-950">{value}</div>
            <div className="text-sm font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur">
          <h3 className="font-bold text-gray-950">Chamados por status</h3>
          <div className="mt-5 space-y-3">
            {Object.entries(statusLabels).map(([key, label]) => {
              const value = metrics.by_status[key] || 0;
              const width = Math.max(8, Math.min(100, value * 12));
              return <div key={key}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><b>{value}</b></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="progress-bar h-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${width}%` }} /></div></div>;
            })}
          </div>
        </div>
        <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur">
          <h3 className="font-bold text-gray-950">Mais recentes</h3>
          <div className="mt-4 space-y-3">
            {metrics.recent.map((ticket: any) => <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="list-card block rounded-md border border-gray-100 bg-white p-3 transition"><div className="font-mono text-sm font-bold text-indigo-700">{ticket.code}</div><div className="truncate text-sm font-semibold text-gray-800">{ticket.title}</div></Link>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", category: "" });
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  async function load() {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const data = unwrap<{ items: Ticket[] }>(await api.get("/tickets", { params }));
      setTickets(data.items);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageTitle title={user?.role === "requester" ? "Meus Chamados" : "Todos os Chamados"} action={<Link to="/tickets/new"><Button><Plus size={16} /> Novo Chamado</Button></Link>} />
      <div className="panel-card grid gap-3 rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur md:grid-cols-[1fr_160px_160px_220px_auto]">
        <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={16} /><Input placeholder="Buscar por código ou título" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-9" /></div>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Status</option>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="">Prioridade</option>{Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">Categoria</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>
        <Button onClick={load} busy={loading}><SlidersHorizontal size={16} /> Filtrar</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="hidden grid-cols-[130px_1fr_150px_130px_190px_180px] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold uppercase text-gray-500 lg:grid">
          <span>Código</span><span>Título</span><span>Status</span><span>Prioridade</span><span>Responsável</span><span>SLA</span>
        </div>
        {loading ? <TicketListSkeleton /> : tickets.length === 0 ? <EmptyState /> : tickets.map((ticket) => (
          <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="ticket-row grid gap-3 border-b border-gray-100 px-4 py-4 transition lg:grid-cols-[130px_1fr_150px_130px_190px_180px] lg:items-center">
            <span className="font-mono text-sm font-extrabold text-indigo-700">{ticket.code}</span>
            <span className="min-w-0"><b className="block truncate text-sm text-gray-950">{ticket.title}</b><small className="text-gray-500">{ticket.category}</small></span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-sm text-gray-600">{ticket.assignee?.name || "Não atribuído"}</span>
            <span className={cx("text-sm font-semibold", ticket.is_overdue ? "text-red-700" : "text-gray-600")}>{ticket.is_overdue ? "ATRASADO" : formatDate(ticket.sla_deadline)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewTicketPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: categories[0], priority: "medium" });
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const ticket = unwrap<Ticket>(await api.post("/tickets", form));
      navigate(`/tickets/${ticket.id}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Novo Chamado" />
      <form onSubmit={submit} className="panel-card mt-5 space-y-5 rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
        <label className="block text-sm font-semibold text-gray-700">Título<Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></label>
        <label className="block text-sm font-semibold text-gray-700">Descrição<Textarea required rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-gray-700">Categoria<Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1">{categories.map((c) => <option key={c}>{c}</option>)}</Select></label>
          <label className="block text-sm font-semibold text-gray-700">Prioridade<Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1">{Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></label>
        </div>
        <div className="flex flex-col justify-end gap-3 sm:flex-row"><Link to="/tickets"><Button type="button" variant="secondary">Cancelar</Button></Link><Button busy={loading}><Plus size={16} /> {loading ? "Abrindo..." : "Abrir Chamado"}</Button></div>
      </form>
    </div>
  );
}

function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [comment, setComment] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const { toast, showToast } = useToast();
  const canEdit = user?.role === "admin" || user?.role === "attendant";

  async function load() {
    if (!id) return;
    setTicket(unwrap<Ticket>(await api.get(`/tickets/${id}`)));
    setComments(unwrap<Comment[]>(await api.get(`/tickets/${id}/comments`)));
    setHistory(unwrap<HistoryEvent[]>(await api.get(`/tickets/${id}/history`)));
    if (user?.role === "admin") setUsers(unwrap<User[]>(await api.get("/users")));
  }
  useEffect(() => { load(); }, [id]);

  async function patch(path: string, body: any) {
    if (!id) return;
    setTicket(unwrap<Ticket>(await api.patch(`/tickets/${id}/${path}`, body)));
    await load();
  }

  async function attendTicket() {
    if (!user) return;
    setBusyAction("attend");
    try {
      await patch("assign", { assignee_id: user.id });
      await patch("status", { status: "in_progress" });
      showToast("Chamado assumido");
    } finally {
      setBusyAction("");
    }
  }

  async function resolveTicket() {
    setBusyAction("resolve");
    try {
      await patch("status", { status: "resolved" });
      showToast("Chamado resolvido");
    } finally {
      setBusyAction("");
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusyAction("comment");
    try {
      await api.post(`/tickets/${id}/comments`, { content: comment, is_internal: false });
      setComment("");
      await load();
      showToast("Comentario adicionado");
    } finally {
      setBusyAction("");
    }
  }

  if (!ticket) return <Skeleton title="Carregando chamado" />;
  const attendants = users.filter((u) => u.role === "attendant" || u.role === "admin");
  return (
    <div className="space-y-5">
      {toast}
      <PageTitle title={`${ticket.code} - ${ticket.title}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{ticket.description}</p>
          </div>
          <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
            <h3 className="flex items-center gap-2 font-bold text-gray-950"><MessageSquare size={18} /> Comentários</h3>
            <div className="mt-4 space-y-4">{comments.length === 0 ? <MiniEmpty label="Nenhum comentario ainda" /> : comments.map((c) => <div key={c.id} className="comment-card rounded-md bg-gray-50 p-4"><div className="text-sm font-bold">{c.author.name}</div><div className="mt-1 text-sm text-gray-700">{c.content}</div><div className="mt-2 text-xs text-gray-400">{relative(c.created_at)}</div></div>)}</div>
            <form onSubmit={addComment} className="mt-5 space-y-3"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário" /><Button busy={busyAction === "comment"}>Adicionar comentário</Button></form>
          </div>
          <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
            <h3 className="font-bold text-gray-950">Histórico</h3>
            <div className="mt-4 space-y-3">{history.map((h) => <div key={h.id} className="history-item border-l-2 border-indigo-200 pl-4"><div className="text-sm font-semibold text-gray-800">{h.description}</div><div className="text-xs text-gray-500">{h.changed_by.name} - {relative(h.created_at)}</div></div>)}</div>
          </div>
        </section>
        <aside className="panel-card h-fit rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur xl:sticky xl:top-24">
          <h3 className="font-bold text-gray-950">Detalhes</h3>
          {canEdit && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {ticket.assignee?.id !== user?.id && ticket.status !== "resolved" && ticket.status !== "cancelled" && (
                <Button type="button" variant="success" busy={busyAction === "attend"} onClick={attendTicket}>
                  <UserCheck size={16} /> Atender chamado
                </Button>
              )}
              {ticket.status !== "resolved" && ticket.status !== "cancelled" && (
                <Button type="button" variant="secondary" busy={busyAction === "resolve"} onClick={resolveTicket}>
                  <CheckCircle2 size={16} /> Resolver
                </Button>
              )}
            </div>
          )}
          <div className="mt-5 space-y-4">
            <Field label="Status">{canEdit ? <Select value={ticket.status} onChange={(e) => patch("status", { status: e.target.value })}>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select> : <StatusBadge status={ticket.status} />}</Field>
            <Field label="Prioridade">{canEdit ? <Select value={ticket.priority} onChange={(e) => patch("priority", { priority: e.target.value })}>{Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select> : <PriorityBadge priority={ticket.priority} />}</Field>
            <Field label="Responsável">{canEdit && user?.role === "admin" ? <Select value={ticket.assignee?.id || ""} onChange={(e) => patch("assign", { assignee_id: e.target.value || null })}><option value="">Não atribuído</option>{attendants.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select> : <span className="text-sm text-gray-700">{ticket.assignee?.name || "Não atribuído"}</span>}</Field>
            <Field label="Solicitante"><span className="text-sm text-gray-700">{ticket.requester.name}</span></Field>
            <Field label="SLA"><span className={cx("text-sm font-bold", ticket.is_overdue ? "text-red-700" : "text-gray-700")}>{ticket.is_overdue ? "ATRASADO" : formatDate(ticket.sla_deadline)}</span></Field>
            <Field label="Abertura"><span className="text-sm text-gray-700">{formatDate(ticket.created_at)}</span></Field>
          </div>
        </aside>
      </div>
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "attendant" as Role });
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState("");
  const { toast, showToast } = useToast();
  async function load() { setUsers(unwrap<User[]>(await api.get("/users"))); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusyUser("create");
    try {
      await api.post("/users", { ...form, is_active: true });
      setForm({ name: "", email: "", password: "", role: "attendant" });
      await load();
      showToast("Usuario criado");
    } finally {
      setBusyUser("");
    }
  }
  async function toggle(id: string) {
    setBusyUser(id);
    try {
      await api.patch(`/users/${id}/toggle-active`);
      await load();
      showToast("Status atualizado");
    } finally {
      setBusyUser("");
    }
  }
  return (
    <div className="space-y-5">
      {toast}
      <PageTitle title="Gerenciar Usuários" />
      <form onSubmit={create} className="panel-card grid gap-3 rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur lg:grid-cols-[1fr_1fr_160px_160px_auto]">
        <Input placeholder="Nome" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Senha" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="attendant">Atendente</option><option value="requester">Solicitante</option><option value="admin">Admin</option></Select>
        <Button busy={busyUser === "create"}><UserPlus size={16} /> Criar</Button>
      </form>
      <div className="overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-sm backdrop-blur">
        {loading ? <TicketListSkeleton /> : users.map((u) => <div key={u.id} className="ticket-row grid gap-3 border-b border-gray-100 p-4 lg:grid-cols-[1fr_1fr_120px_100px_auto] lg:items-center"><div className="font-bold text-gray-900">{u.name}</div><div className="text-sm text-gray-600">{u.email}</div><Badge tone="bg-gray-100 text-gray-700">{u.role}</Badge><span className={cx("text-sm font-bold", u.is_active ? "text-green-700" : "text-red-700")}>{u.is_active ? "Ativo" : "Inativo"}</span><Button type="button" busy={busyUser === u.id} variant={u.is_active ? "secondary" : "success"} onClick={() => toggle(u.id)}>{u.is_active ? "Desativar" : <><UserCheck size={16} /> Ativar</>}</Button></div>)}
      </div>
    </div>
  );
}

function PageTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex min-w-0 items-center gap-2 text-2xl font-extrabold text-gray-950"><Sparkles size={22} className="shrink-0 text-fuchsia-500" /><span className="truncate">{title}</span></h1>{action}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-xs font-bold uppercase text-gray-400">{label}</div>{children}</div>;
}

function Skeleton({ title }: { title: string }) {
  return <div className="panel-card rounded-lg border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur"><div className="h-5 w-56 animate-shimmer rounded bg-gray-100" /><p className="mt-4 text-sm text-gray-500">{title}</p></div>;
}

function EmptyState() {
  return <div className="empty-state flex flex-col items-center justify-center p-12 text-center"><div className="empty-orbit flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><CircleUserRound size={36} /></div><h3 className="mt-3 font-bold text-gray-900">Nenhum chamado encontrado</h3><p className="mt-1 text-sm text-gray-500">Ajuste os filtros ou crie um novo chamado.</p></div>;
}

function MiniEmpty({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-sm font-semibold text-indigo-700"><Zap className="mr-2 inline" size={16} />{label}</div>;
}

function TicketListSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="grid gap-3 border-b border-gray-100 px-4 py-4 lg:grid-cols-[130px_1fr_150px_130px_190px_180px]">
          <div className="h-4 animate-shimmer rounded bg-gray-100" />
          <div className="h-4 animate-shimmer rounded bg-gray-100" />
          <div className="h-6 animate-shimmer rounded bg-gray-100" />
          <div className="h-6 animate-shimmer rounded bg-gray-100" />
          <div className="h-4 animate-shimmer rounded bg-gray-100" />
          <div className="h-4 animate-shimmer rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function relative(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Protected><AppLayout /></Protected>} />
    </Routes>
  );
}
