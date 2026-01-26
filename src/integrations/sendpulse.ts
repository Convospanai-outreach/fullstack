import sendpulse from 'sendpulse-api';
import { logger } from '@/lib/logger';

const API_USER_ID = process.env['SENDPULSE_ID'] || "";
const API_SECRET = process.env['SENDPULSE_SECRET'] || "";
const TOKEN_STORAGE = "/tmp/";

let isInitialized = false;

async function init() {
  if (isInitialized) return;
  return new Promise<void>((resolve) => {
    sendpulse.init(API_USER_ID, API_SECRET, TOKEN_STORAGE, (token: any) => {
      if (token && token.is_error) {
        logger.error("[SendPulse] Initialization failed", { message: token.message });
      } else {
        logger.info("[SendPulse] Initialized successfully");
        isInitialized = true;
      }
      resolve();
    });
  });
}

export async function sendEmailViaSendPulse(
  to: string,
  subject: string,
  html: string,
  fromName: string = "ConvoSpan User",
  fromEmail: string = "noreply@convospan.com"
) {
  await init();

  const email = {
    "html": html,
    "text": html.replace(/<[^>]*>?/gm, ''), // Simple strip tags
    "subject": subject,
    "from": {
      "name": fromName,
      "email": fromEmail
    },
    "to": [
      {
        "name": to.split("@")[0], // Fallback name
        "email": to
      }
    ]
  };

  return new Promise((resolve, reject) => {
    sendpulse.smtpSendMail((data: any) => {
      if (data && data.is_error) {
        logger.error("[SendPulse] SMTP send failed", { data });
        reject(data);
      } else {
        logger.info(`[SendPulse] Email sent to ${to}`);
        resolve(data);
      }
    }, email);
  });
}

export async function createMailingList(listName: string) {
  await init();
  return new Promise((resolve, reject) => {
    sendpulse.createAddressBook((data: any) => {
      if (data && data.is_error) {
        reject(data);
      } else {
        resolve(data);
      }
    }, listName);
  });
}

export async function addEmailsToBook(bookId: string, emails: string[]) {
  await init();
  const emailObjects = emails.map(email => ({ email, variables: {} }));
  return new Promise((resolve, reject) => {
    sendpulse.addEmails((data: any) => {
      if (data && data.is_error) {
        reject(data);
      } else {
        resolve(data);
      }
    }, bookId, emailObjects);
  });
}
