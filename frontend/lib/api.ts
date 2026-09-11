import type {
  ApprovalBody,
  ApprovalResponse,
  DealDetail,
  DealSummary,
  LineItemApprovalBody,
  LineItemCreateBody,
  LineItemDecisionBody,
  LineItemDetail,
  LineItemUpdateBody,
  LoginResponse,
  Role,
} from "@/lib/api-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Matches the seeded mock users in backend/app/auth.py — no real user database.
export const ROLE_LOGIN_EMAIL: Record<Role, string> = {
  sales_rep: "rep@dealreview.dev",
  manager: "manager@dealreview.dev",
};

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", token, body } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${path}`, init);

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (Array.isArray(data?.detail) && data.detail.every((d: unknown) => typeof d === "object")) {
      const fieldErrors = data.detail as FieldError[];
      throw new ApiError(
        res.status,
        fieldErrors.map((e) => e.message).join("; ") || "Request failed",
        fieldErrors,
      );
    }
    const message =
      typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export function login(email: string, role: Role): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", { method: "POST", body: { email, role } });
}

export function listDeals(token: string): Promise<DealSummary[]> {
  return request<DealSummary[]>("/api/deals", { token });
}

export function getDeal(token: string, dealId: string): Promise<DealDetail> {
  return request<DealDetail>(`/api/deals/${dealId}`, { token });
}

export function addLineItem(
  token: string,
  dealId: string,
  body: LineItemCreateBody,
): Promise<LineItemDetail> {
  return request<LineItemDetail>(`/api/deals/${dealId}/line-items`, {
    method: "POST",
    token,
    body,
  });
}

export function updateLineItem(
  token: string,
  dealId: string,
  lineItemId: string,
  body: LineItemUpdateBody,
): Promise<LineItemDetail> {
  return request<LineItemDetail>(`/api/deals/${dealId}/line-items/${lineItemId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function removeLineItem(token: string, dealId: string, lineItemId: string): Promise<void> {
  return request<void>(`/api/deals/${dealId}/line-items/${lineItemId}`, {
    method: "DELETE",
    token,
  });
}

export function decideLineItem(
  token: string,
  dealId: string,
  lineItemId: string,
  body: LineItemDecisionBody,
): Promise<LineItemDetail> {
  return request<LineItemDetail>(`/api/deals/${dealId}/line-items/${lineItemId}/decision`, {
    method: "POST",
    token,
    body,
  });
}

export function decideLineItemApproval(
  token: string,
  dealId: string,
  lineItemId: string,
  body: LineItemApprovalBody,
): Promise<LineItemDetail> {
  return request<LineItemDetail>(`/api/deals/${dealId}/line-items/${lineItemId}/approval`, {
    method: "POST",
    token,
    body,
  });
}

export function decideApproval(
  token: string,
  dealId: string,
  body: ApprovalBody,
): Promise<ApprovalResponse> {
  return request<ApprovalResponse>(`/api/deals/${dealId}/approval`, {
    method: "POST",
    token,
    body,
  });
}

export function undoApproval(token: string, dealId: string): Promise<ApprovalResponse> {
  return request<ApprovalResponse>(`/api/deals/${dealId}/approval/undo`, { method: "POST", token });
}
