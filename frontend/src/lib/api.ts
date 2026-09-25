import axios from "axios";
import { useQuery, useMutation } from "@tanstack/react-query";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// React Query Hooks

export const useHealth = () =>
  useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await api.get("/health");
      return res.data;
    },
    refetchInterval: 30000,
  });

export const useBriefing = () =>
  useQuery({
    queryKey: ["briefing"],
    queryFn: async () => {
      const res = await api.get("/briefing/today");
      return res.data;
    },
    refetchInterval: 60000,
  });

export const useNeoList = (options: { hazardousOnly?: boolean; search?: string; minAnomaly?: number } = {}) =>
  useQuery({
    queryKey: ["neo-list", options],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (options.hazardousOnly) params.hazardous_only = true;
      if (options.search) params.search = options.search;
      if (options.minAnomaly !== undefined) params.min_anomaly = options.minAnomaly;
      const res = await api.get("/neo", { params });
      return res.data;
    },
  });

export const useNeoDetail = (entityId: string | null) =>
  useQuery({
    queryKey: ["neo", entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await api.get(`/neo/${entityId}`);
      return res.data;
    },
    enabled: !!entityId,
  });

export const useForecast = (entityId: string | null) =>
  useQuery({
    queryKey: ["forecast", entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await api.get(`/neo/${entityId}/forecast`);
      return res.data;
    },
    enabled: !!entityId,
  });

export const useOrbitalElements = (entityId: string | null) =>
  useQuery({
    queryKey: ["orbit", entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await api.get(`/neo/${entityId}/orbit`);
      return res.data;
    },
    enabled: !!entityId,
  });

export const useAllOrbits = () =>
  useQuery({
    queryKey: ["all-orbits"],
    queryFn: async () => {
      const res = await api.get("/neo/orbits/all");
      return res.data;
    },
  });

export const useLineage = (entityId: string | null) =>
  useQuery({
    queryKey: ["trace", entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await api.get(`/neo/${entityId}/trace`);
      return res.data;
    },
    enabled: !!entityId,
  });

export const useMiningList = () =>
  useQuery({
    queryKey: ["mining"],
    queryFn: async () => {
      const res = await api.get("/mining");
      return res.data;
    },
  });

export const useReports = () =>
  useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await api.get("/reports/latest");
      return res.data;
    },
  });

export const useAgentQuery = () =>
  useMutation({
    mutationFn: async (question: string) => {
      const res = await api.post("/agent/query", { question });
      return res.data;
    },
  });
