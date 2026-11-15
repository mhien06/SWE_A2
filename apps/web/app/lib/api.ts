export type ApiSession = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "CUSTOMER" | "STAFF" | "MANAGER";
    pointsBalance: number;
  };
};

const sessionKey = "brewlite.session";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const sessionEvent = "brewlite:session-changed";
let sessionSnapshot: ApiSession | null = null;
let sessionInitialized = false;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function saveSession(session: ApiSession) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  sessionSnapshot = session;
  sessionInitialized = true;
  window.dispatchEvent(new Event(sessionEvent));
}

export function readSession(): ApiSession | null {
  if (typeof window === "undefined") return null;
  if (sessionInitialized) return sessionSnapshot;
  const saved = sessionStorage.getItem(sessionKey);
  if (!saved) {
    sessionSnapshot = null;
    sessionInitialized = true;
    return sessionSnapshot;
  }
  try {
    const parsed: unknown = JSON.parse(saved);
    sessionSnapshot = isApiSession(parsed) ? parsed : null;
  } catch {
    sessionSnapshot = null;
  }
  sessionInitialized = true;
  return sessionSnapshot;
}

export function clearSession() {
  sessionStorage.removeItem(sessionKey);
  sessionSnapshot = null;
  sessionInitialized = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(sessionEvent));
  }
}

export function subscribeSession(listener: () => void) {
  window.addEventListener(sessionEvent, listener);
  window.addEventListener("brewlite:session-expired", listener);
  return () => {
    window.removeEventListener(sessionEvent, listener);
    window.removeEventListener("brewlite:session-expired", listener);
  };
}

export function getSessionSnapshot() {
  return readSession();
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const session = readSession();
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("brewlite:session-expired"));
    }
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }
  return payload as T;
}

function isApiSession(value: unknown): value is ApiSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiSession>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.user?.id === "string" &&
    typeof candidate.user.role === "string"
  );
}

function errorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  if (typeof payload === "string" && payload) return payload;
  return `Request failed (${status})`;
}
