import { useContext } from "react";
import { GenerateContext } from "./GenerateProvider";

export function useGenerate() {
  const ctx = useContext(GenerateContext);
  if (!ctx) throw new Error("useGenerate must be used within GenerateProvider");
  return ctx;
}