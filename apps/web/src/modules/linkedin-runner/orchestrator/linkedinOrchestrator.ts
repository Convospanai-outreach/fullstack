import { linkedinRunnerService } from "../service/linkedinRunnerService";

export async function runLinkedInTask(task: any) {
    return linkedinRunnerService.runAutomation(task);
}
