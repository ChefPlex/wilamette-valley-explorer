import { setBaseUrl } from "@workspace/api-client-react";

export { setBaseUrl };

export function getApiUrl(): string {
  return `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "localhost"}`;
}
