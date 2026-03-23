import { BaseAgent } from "../BaseAgent";

export interface ICPInput {
    industry: string;
    role: string;
    size: string;
    painPoints: string;
}

export interface ICPResult {
    keywords: string[];
    booleanString: string;
    personaHook: string;
}

export class ICPAgent extends BaseAgent {
    async generate(input: ICPInput): Promise<ICPResult> {
        const prompt = `
            Act as an expert B2B Sales Strategist.
            Generate an Ideal Customer Profile (ICP) based on the following criteria:
            - Target Industry: ${input.industry}
            - Decision Maker Role: ${input.role}
            - Company Size: ${input.size}
            - Key Pain Points: ${input.painPoints}

            Tasks:
            1. Identify 5-10 high-intent keywords relevant to this persona.
            2. Construct a complex Boolean Search String for LinkedIn Sales Navigator to find these people.
            3. Write a "Persona Hook" - a 1-2 sentence psychological insight into what keeps this person up at night, to be used in email intros.
        `;

        const schema = `
        {
            "keywords": ["string"],
            "booleanString": "string",
            "personaHook": "string"
        }
        `;

        return this.generateJSON<ICPResult>(prompt, schema);
    }
}
