import { MailProviderFactory } from "./MailProviderFactory";
import { GoogleWorkspaceProvider } from "./GoogleWorkspaceProvider";
import { SmtpProvider } from "./SmtpProvider";
import { MicrosoftGraphProvider } from "./MicrosoftGraphProvider";
import { ResendProvider } from "./ResendProvider";

// Register all available providers with factory
MailProviderFactory.register(new GoogleWorkspaceProvider());
MailProviderFactory.register(new SmtpProvider());
MailProviderFactory.register(new MicrosoftGraphProvider());
MailProviderFactory.register(new ResendProvider());

export { MailProviderFactory } from "./MailProviderFactory";
export type { MailProvider, SendEmailInput, SendEmailResult } from "./MailProvider";
export { MailProviderError } from "./MailProvider";
export { GoogleWorkspaceProvider } from "./GoogleWorkspaceProvider";
export { SmtpProvider } from "./SmtpProvider";
export { MicrosoftGraphProvider } from "./MicrosoftGraphProvider";
export { ResendProvider } from "./ResendProvider";
