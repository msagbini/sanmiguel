const TOKEN_KEY = "sanmiguel_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`/api${path}`, { ...options, headers });

  if (resp.status === 204) return undefined as T;

  const isJson = resp.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await resp.json().catch(() => null) : null;

  if (!resp.ok) {
    const message =
      body?.error && typeof body.error === "string"
        ? body.error
        : body?.error
          ? JSON.stringify(body.error)
          : `Error ${resp.status}`;
    throw new ApiError(message, resp.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
