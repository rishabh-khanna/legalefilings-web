import type { ActionMessage as ActionMessageType } from "@/lib/use-action-message";

export function ActionMessage({ message }: { message: ActionMessageType }) {
  if (!message) return null;
  const isSuccess = message.kind === "success";
  return (
    <p
      className="mb-4 rounded-lg px-3 py-2 text-sm"
      style={
        isSuccess
          ? { backgroundColor: "#d0f4db", color: "#116a2c" }
          : { backgroundColor: "#fde2e2", color: "#b42318" }
      }
    >
      {message.text}
    </p>
  );
}
