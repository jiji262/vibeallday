import { createContext, type ReactNode, useContext } from "react";
import type { VibeAllDaySourceRuntime } from "./sourceRuntime";

const SourceRuntimeContext = createContext<VibeAllDaySourceRuntime | null>(
  null,
);

interface SourceRuntimeProviderProps {
  children: ReactNode;
  runtime: VibeAllDaySourceRuntime;
}

export function SourceRuntimeProvider({
  children,
  runtime,
}: SourceRuntimeProviderProps) {
  return (
    <SourceRuntimeContext.Provider value={runtime}>
      {children}
    </SourceRuntimeContext.Provider>
  );
}

export function useSourceRuntimeContextValue(): VibeAllDaySourceRuntime | null {
  return useContext(SourceRuntimeContext);
}
