import { useContext } from "react";
import { ModesContext } from "./ModesProvider";

export const useModes = () => useContext(ModesContext);
