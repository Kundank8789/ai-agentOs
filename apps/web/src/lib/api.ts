const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function getTasks() {
  const response = await fetch(`${API_URL}/tasks/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }

  return response.json();
}

export async function getApprovals() {
  const response = await fetch(`${API_URL}/approvals/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch approvals");
  }

  return response.json();
}

export async function createTask(
  title: string,
  description: string,
) {
  const response = await fetch(`${API_URL}/tasks/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
  const response = await fetch(
    `${API_URL}/tasks/${taskId}/run`,
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
  const response = await fetch(
    `${API_URL}/tasks/${taskId}/steps`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch task steps");
  }

  return response.json();
}

export async function getTaskAudit(taskId: string) {
  const response = await fetch(
    `${API_URL}/tasks/${taskId}/audit`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch audit logs");
  }

  return response.json();
}

export async function approveApproval(
  approvalId: string,
) {
  const response = await fetch(
    `${API_URL}/approvals/${approvalId}/approve`,
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
  const response = await fetch(
    `${API_URL}/approvals/${approvalId}/reject`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to reject action");
  }

  return response.json();
}