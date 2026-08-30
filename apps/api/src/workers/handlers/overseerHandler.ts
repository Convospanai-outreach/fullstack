import { runOverseerTick } from "@/modules/overseer/overseerService";

export async function processOverseerTick() {
    return runOverseerTick();
}
