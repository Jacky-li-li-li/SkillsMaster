export interface ModelConfig {
  id: string;
  name: string;
  model: string;
  baseURL: string;
  apiKey: string;
  isActive: boolean;
}

export const MODEL_CONFIGS_STORAGE_KEY = "skill-garden-model-configs";

export function loadModelConfigs(): ModelConfig[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(MODEL_CONFIGS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ModelConfig => {
      if (!item || typeof item !== "object") return false;
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.model === "string" &&
        typeof obj.baseURL === "string" &&
        typeof obj.apiKey === "string" &&
        typeof obj.isActive === "boolean"
      );
    });
  } catch {
    return [];
  }
}

export function saveModelConfigs(configs: ModelConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODEL_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
}

export function getActiveModelConfig(configs: ModelConfig[]): ModelConfig | null {
  return configs.find((item) => item.isActive) ?? null;
}
