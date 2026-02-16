let API_URL = "";

export function configureApiClient(apiBaseUrl = "") {
  API_URL = String(apiBaseUrl || "").trim().replace(/\/$/, "");
}

export function hasApiConfig() {
  return Boolean(API_URL);
}

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  if (!API_URL) {
    throw new Error("apiBaseUrl is not configured for @ha/chat-customer");
  }
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export async function getGuestToken() {
  return requestJson("/auth/guest-token", { method: "POST" });
}

export async function getAgentToken({ agentId, role = "agent", canManageSettings = false } = {}) {
  return requestJson("/auth/agent-token", {
    method: "POST",
    body: {
      agent_id: agentId,
      role,
      can_manage_settings: canManageSettings
    }
  });
}

export async function startConversation({
  idToken,
  type,
  appointmentId,
  initialMessage,
  clientMessageId,
  queue
}) {
  return requestJson("/conversations/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    body: {
      type,
      appointment_id: appointmentId,
      initial_message: initialMessage,
      client_message_id: clientMessageId,
      queue
    }
  });
}

export async function getArchivedConversationByAppointment({ idToken, appointmentId }) {
  return requestJson(`/conversations/archived/appointment/${appointmentId}`, {
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });
}

export async function markConversationRead({ idToken, conversationId }) {
  return requestJson(`/conversations/${conversationId}/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });
}
