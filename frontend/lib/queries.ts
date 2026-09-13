import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type {
  ApprovalBody,
  DealCreateBody,
  DealUpdateBody,
  LineItemApprovalBody,
  LineItemCreateBody,
  LineItemDecisionBody,
  LineItemUpdateBody,
  Role,
  SendQuoteBody,
} from "@/lib/api-types";
import { useSession } from "@/lib/session";

export const dealKeys = {
  all: ["deals"] as const,
  detail: (dealId: string) => ["deals", dealId] as const,
};

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: Role }) => api.login(email, role),
  });
}

export function useDealsQuery() {
  const { token, isSignedIn } = useSession();
  return useQuery({
    queryKey: dealKeys.all,
    queryFn: () => api.listDeals(token!),
    enabled: isSignedIn,
  });
}

export function useCreateDealMutation() {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DealCreateBody) => api.createDeal(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useDealQuery(dealId: string) {
  const { token, isSignedIn } = useSession();
  return useQuery({
    queryKey: dealKeys.detail(dealId),
    queryFn: () => api.getDeal(token!, dealId),
    enabled: isSignedIn && !!dealId,
  });
}

export function useUpdateDealMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DealUpdateBody) => api.updateDeal(token!, dealId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useAddLineItemMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LineItemCreateBody) => api.addLineItem(token!, dealId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUpdateLineItemMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineItemId, body }: { lineItemId: string; body: LineItemUpdateBody }) =>
      api.updateLineItem(token!, dealId, lineItemId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useRemoveLineItemMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineItemId: string) => api.removeLineItem(token!, dealId, lineItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useDecisionMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineItemId, body }: { lineItemId: string; body: LineItemDecisionBody }) =>
      api.decideLineItem(token!, dealId, lineItemId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
    },
  });
}

export function useLineItemApprovalMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineItemId, body }: { lineItemId: string; body: LineItemApprovalBody }) =>
      api.decideLineItemApproval(token!, dealId, lineItemId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useApprovalMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ApprovalBody) => api.decideApproval(token!, dealId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUndoApprovalMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.undoApproval(token!, dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useSendQuoteMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SendQuoteBody) => api.sendQuote(token!, dealId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUndoSendQuoteMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.undoSendQuote(token!, dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUndoLineItemDecisionMutation(dealId: string) {
  const { token } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineItemId: string) => api.undoLineItemDecision(token!, dealId, lineItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}
