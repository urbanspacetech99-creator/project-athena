import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Modes } from "./types";

const ModesCtx = createContext<Modes | undefined>(undefined);

/** Fetches /config/modes once per app load (in-memory only — must reflect env
 *  changes on reload). On failure modes stay undefined and StatusBadge renders
 *  nothing, so no view ever breaks on this call. */
export function ModesProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState<Modes | undefined>(undefined);
  useEffect(() => { api.modes().then(setModes, () => undefined); }, []);
  return <ModesCtx.Provider value={modes}>{children}</ModesCtx.Provider>;
}

export const useModes = () => useContext(ModesCtx);
