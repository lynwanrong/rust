import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export function useTauriEvent(eventName, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let unlisten;
    let cancelled = false;

    const setup = async () => {
      const fn = await listen(eventName, (event) => {
        if (!cancelled) handlerRef.current(event.payload);
      });
      if (!cancelled) unlisten = fn;
    };
    setup();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [eventName]);
}
