
import { ModelRequest, ModelResponse, LLMProvider } from "../types.js";

export abstract class BaseProvider {
    abstract getProviderName(): LLMProvider;
    abstract generate(request: ModelRequest): Promise<ModelResponse>;
}
