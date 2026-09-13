import { useEffect, useState } from "react";
import { openOrderSocket } from "../services/socketService";

export function useSocket() {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(true);
    const close = openOrderSocket(
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
