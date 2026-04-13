import { getOrCreateLocalClientId } from "@/lib/client/local-client-id";

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-local-client-id", getOrCreateLocalClientId());

  return fetch(input, {
    ...init,
    headers,
  });
}
