"use client";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export default function StatusMonitor() {
  const [status, setStatus] = useState<string>("NULL");
  const [requestId, setRequestId] = useState<string | null>(null);
  const sendRequest = api.request.sendRequest.useMutation();
  const handleSendRequest = async () => {
    const response = await sendRequest.mutateAsync();
    setRequestId(response.id); // Set requestId after sending request
    setStatus(response.status);
  };
  api.request.subscribeToRequest.useSubscription(
    { id: requestId, lastEventId: 0 },
    {
      onData(data) {
        if (!data.id) {
        }
        setStatus(data.data.status);
      },
      onError(err) {
        console.error(err);
      },
      enabled:
        requestId !== null && status !== "FINISHED" && status !== "ERROR",
    },
  );
  useEffect(() => {
    if (requestId === null) {
      return;
    }
  }, [requestId]);

  if (sendRequest.error) {
    return <div>Error</div>;
  }
  return (
    <div className="flex items-center gap-2">
      <span>
        Current status: {status !== "NULL" ? status : "NO REQUEST SENT"}
      </span>
      <button onClick={handleSendRequest} className="rounded-xl border p-2">
        Send request
      </button>
      <span>Current id: {requestId ?? "none"}</span>
    </div>
  );
}
