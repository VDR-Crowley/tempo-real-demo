import { useEffect, useState } from "react";
import { openOrderStream } from "../services/sseService";

export function useSSE() {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(true);
    const close = openOrderStream(
      (snapshot) => {
        setData(snapshot);
        setLog((prev) => [snapshot, ...prev].slice(0, 8));
      },
      () => setConnected(false)
    );

    return () => {
      close();
      setConnected(false);
    };
  }, []);

  return { data, log, connected };
}
