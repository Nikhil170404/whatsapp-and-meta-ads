import { markReadWithTyping, sendButtonMessage, sendImageMessage, sendListMessage, sendLocationRequest, sendTextMessage } from "@/lib/whatsapp/service";
import type { Action } from "./engine";
import type { FlowSender } from "./runtime";

/** Sends flow messages to one customer through the WhatsApp Cloud API. */
export function whatsappFlowSender(opts: { phoneNumberId: string; token: string; to: string }): FlowSender {
  const { phoneNumberId, token, to } = opts;
  return {
    async send(a: Action) {
      let res: any;
      switch (a.type) {
        case "text": res = await sendTextMessage(phoneNumberId, to, a.text, token); break;
        case "image": res = await sendImageMessage(phoneNumberId, to, a.url, a.caption, token); break;
        case "buttons": res = await sendButtonMessage(phoneNumberId, to, a.text, a.buttons, token); break;
        case "list": res = await sendListMessage(phoneNumberId, to, a.text, a.buttonLabel, a.rows, token); break;
        case "location_request": res = await sendLocationRequest(phoneNumberId, to, a.text, token); break;
        default: return null;
      }
      return res?.messages?.[0]?.id ?? null;
    },
    typing: (messageId) => markReadWithTyping(phoneNumberId, messageId, token),
  };
}
