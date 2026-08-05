import { createContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { Modes } from "../types";

/** Consumed via the useModes hook (providers/useModes.ts). */
export const ModesContext = createContext<Modes | undefined>(undefined);

/** Fetches /config/modes once per app load (in-memory only — must reflect env
 *  changes on reload). On failure modes stay undefined and StatusBadge renders
 *  nothing, so no view ever breaks on this call. */
export function ModesProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState<Modes | undefined>(undefined);
  useEffect(() => { api.modes().then(setModes, () => undefined); }, []);
  return <ModesContext.Provider value={modes}>{children}</ModesContext.Provider>;
}
