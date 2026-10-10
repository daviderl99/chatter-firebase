import { createContext, useContext } from "react";

const noop = () => {};

export const ToastContext = createContext({
  error: noop,
  success: noop,
  info: noop,
});

export function useToast() {
  return useContext(ToastContext);
}
