"use client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  accessToken: string | undefined,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));

  if (!res.ok) {
    throw new ApiError(res.status, data.detail ?? "Unknown error");
  }

  return data as T;
}

export function createApi(accessToken: string | undefined) {
  return {
    get: <T>(path: string) => request<T>(path, accessToken),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, accessToken, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
      request<T>(path, accessToken, { method: "PUT", body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, accessToken, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, accessToken, { method: "DELETE" }),
  };
}
