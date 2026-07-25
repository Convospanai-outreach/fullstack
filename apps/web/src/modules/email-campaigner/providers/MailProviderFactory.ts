import { MailProvider } from "./MailProvider";

export class MailProviderFactory {
  private static registry = new Map<string, MailProvider>();

  static register(provider: MailProvider) {
    this.registry.set(provider.providerKey, provider);
  }

  static getProvider(providerKey: string): MailProvider {
    const provider = this.registry.get(providerKey);
    if (!provider) {
      throw new Error(`No MailProvider registered for provider key "${providerKey}". Supported: ${Array.from(this.registry.keys()).join(", ")}`);
    }
    return provider;
  }
}
