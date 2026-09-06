import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: true } },
});
let csrf = '';
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Connection failed. Please try again.');
  }
  return response.json() as Promise<T>;
}
export function useData<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => api<T>(path), enabled });
}
export function useAction<T = unknown>(path: string, method = 'POST') {
  return useMutation({
    mutationFn: (body?: unknown) => api<T>(path, method, body),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
export async function downloadReport(id: string) {
  const response = await fetch(`/api/soc/incidents/${id}/report`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrf },
  });
  if (!response.ok) throw new Error('Report generation failed. Please try again.');
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `BankGuard-${id.slice(0, 8)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  void queryClient.invalidateQueries();
}
export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
export const date = (value: string) =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
export const human = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
