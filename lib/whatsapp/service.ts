import { env } from "@/lib/env";

const WA_API_URL = "https://graph.facebook.com/v21.0";

export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  templateName: string,
  langCode: string = "en_US",
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getMessageTemplates(wabaId: string, accessToken: string) {
  const response = await fetch(`${WA_API_URL}/${wabaId}/message_templates`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}
