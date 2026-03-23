
import { FeatureFlagService } from "./service";

type FeatureContext = {
    teamId: string;
    userId?: string;
};

/**
 * Wraps a function execution with a strict Feature Flag check.
 * This guarantees that the code block cannot run unless the feature is enabled for the team.
 * 
 * @param featureKey - The feature flag key (e.g., 'whatsapp_outbound')
 * @param context - The context containing teamId (required for resolution)
 * @param handler - The async function to execute if allowed
 */
export async function withFeatureGuard<T>(
    featureKey: string,
    context: FeatureContext,
    handler: () => Promise<T>
): Promise<T> {
    const isEnabled = await FeatureFlagService.isEnabled(featureKey, context.teamId);

    if (!isEnabled) {
        throw new Error(`Feature Access Denied: '${featureKey}' is disabled for this organization.`);
    }

    return await handler();
}
