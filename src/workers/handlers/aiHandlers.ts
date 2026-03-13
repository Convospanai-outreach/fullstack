export const dummy = {}; // Logic migrated to backend

export async function handleAIAction(_payload: any) {
    throw new Error("AI actions are only available on the backend.");
}
