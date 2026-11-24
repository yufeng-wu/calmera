import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { createUiTaskScope } from "@/lib/uiTaskScope.mjs";

export default function useFormTaskScope(owner, resetOnFocus) {
  const scope = useRef(null);
  if (!scope.current) scope.current = createUiTaskScope();
  const reset = useRef(resetOnFocus);
  reset.current = resetOnFocus;
  useFocusEffect(useCallback(() => {
    scope.current.activate(owner);
    reset.current?.();
    return () => scope.current.deactivate();
  }, [owner]));
  return scope.current;
}
