const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "agentos_access_token";

export type AuthResponse = {
  access_token: string;
  token_type: string;
};

export type User = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (response.status === 401) {
    clearToken();

    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;

      if (currentPath !== "/login" && currentPath !== "/signup") {
        window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
      }
    }
  }

  return response;
}

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to create account");
  }

  return response.json();
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Invalid email or password");
  }

  const data: AuthResponse = await response.json();

  setToken(data.access_token);

  return data;
}

export async function getTasks() {
  const response = await apiFetch("/tasks/");

  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }

  return response.json();
}

export async function getTask(taskId: string) {
  const response = await apiFetch(`/tasks/${taskId}`);

  if (!response.ok) {
    throw new Error("Failed to load task");
  }

  return response.json();
}

export async function getApprovals() {
  const response = await apiFetch("/approvals/");

  if (!response.ok) {
    throw new Error("Failed to fetch approvals");
  }

  return response.json();
}

export async function createTask(
  title: string,
  description: string,
  agentId?: string,
) {
  const response = await apiFetch("/tasks/", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      agent_id: agentId || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to create task");
  }

  return response.json();
}

export async function runTask(taskId: string) {
  const response = await apiFetch(
    `/tasks/${taskId}/run`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to run task");
  }

  return response.json();
}

export async function getTaskSteps(taskId: string) {
  const response = await apiFetch(
    `/tasks/${taskId}/steps`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch task steps");
  }

  return response.json();
}

export async function getTaskAudit(taskId: string) {
  const response = await apiFetch(
    `/tasks/${taskId}/audit`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch audit logs");
  }

  return response.json();
}

export async function approveApproval(
  approvalId: string,
) {
  const response = await apiFetch(
    `/approvals/${approvalId}/approve`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to approve action");
  }

  return response.json();
}

export async function rejectApproval(
  approvalId: string,
) {
  const response = await apiFetch(
    `/approvals/${approvalId}/reject`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to reject action");
  }

  return response.json();
}

export type Agent = {
  id: string;
  organization_id?: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  tool_config: Record<string, boolean>;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

export type AgentInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  tool_config?: Record<string, boolean>;
};

export type AgentUpdate = Partial<AgentInput> & {
  status?: "active" | "inactive";
};

export async function getAgents(): Promise<Agent[]> {
  const response = await apiFetch("/agents/");

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to fetch agents");
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createAgent(
  input: AgentInput,
): Promise<Agent> {
  const response = await apiFetch("/agents/", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      tool_config: input.tool_config ?? {},
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to create agent");
  }

  return response.json();
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await apiFetch(`/agents/${agentId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to fetch agent");
  }

  return response.json();
}

export async function updateAgent(
  agentId: string,
  input: AgentUpdate,
): Promise<Agent> {
  const response = await apiFetch(`/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to update agent");
  }

  return response.json();
}

export type Memory = {
  id: string;
  organization_id: string;
  user_id?: string | null;
  agent_id?: string | null;
  type: string;
  key: string;
  value: string;
};

export async function getMemories(): Promise<Memory[]> {
  const response = await apiFetch("/memories/");

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to fetch memories");
  }

  const data = await response.json();

  return Array.isArray(data) ? data : [];
}

export async function createMemory(
  type: string,
  key: string,
  value: string,
  agentId?: string,
): Promise<Memory> {
  const response = await apiFetch("/memories/", {
    method: "POST",
    body: JSON.stringify({
      type,
      key,
      value,
      agent_id: agentId || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to create memory");
  }

  return response.json();
}

export type AuditLog = {
  id: string;
  task_id: string | null;
  task_step_id: string | null;
  tool_call_id: string | null;
  event_type: string;
  actor_type: string;
  action: string;
  message: string | null;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function getAuditLogs(): Promise<AuditLog[]> {
  const response = await apiFetch("/audit-logs/");

  if (!response.ok) {
    throw new Error("Failed to fetch audit logs");
  }

  const data = await response.json();

  return Array.isArray(data) ? data : [];
}

export type AgentTool = {
  name: string;
  description: string;
  category: string;
  approval_required: boolean;
  integration_type: string;
};

export async function getTools(): Promise<AgentTool[]> {
  const response = await apiFetch("/tools/");

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "Failed to fetch tools");
  }

  const data: AgentTool[] = await response.json();

  return Array.isArray(data) ? data : [];
}

export type ToolCall = {
  id: string;
  task_step_id: string;
  tool_name: string;
  call_number: number;
  status: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function getTaskToolCalls(
  taskId: string,
): Promise<ToolCall[]> {
  const response = await apiFetch(
    `/tasks/${taskId}/tool-calls`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail || "Failed to fetch tool execution history",
    );
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function cancelTask(taskId: string) {
  const response = await apiFetch(`/tasks/${taskId}/cancel`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail || "Failed to cancel task",
    );
  }

  return response.json();
}