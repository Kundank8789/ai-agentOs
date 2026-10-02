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
) {
  const response = await apiFetch("/tasks/", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create task");
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
