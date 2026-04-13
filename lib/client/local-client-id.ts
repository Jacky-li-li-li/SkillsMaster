const LOCAL_CLIENT_ID_STORAGE_KEY = "skill-garden-local-client-id";

export function getOrCreateLocalClientId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(LOCAL_CLIENT_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(LOCAL_CLIENT_ID_STORAGE_KEY, created);
  return created;
}
