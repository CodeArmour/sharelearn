"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { ActiveGroup, Membership, UserSummary } from "@/types";

interface ActiveGroupValue {
  user: UserSummary;
  group: ActiveGroup;
  membership: Membership;
}

const Ctx = createContext<ActiveGroupValue | null>(null);

export function ActiveGroupProvider({
  value,
  children,
}: {
  value: ActiveGroupValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveGroup(): ActiveGroupValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useActiveGroup must be used within <ActiveGroupProvider>");
  return value;
}
