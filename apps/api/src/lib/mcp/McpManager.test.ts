import { describe, it, expect } from "vitest";
import { mcpManager } from "./McpManager";

// enforceTeamScopedArgs is private; these tests exercise it directly since it's
// the one chokepoint responsible for preventing an LLM/tool-call-supplied teamId
// from overriding the real session/agent team across every MCP tool it covers.
function enforce(name: string, args: any, teamId?: string) {
    return (mcpManager as any).enforceTeamScopedArgs(name, args, { teamId });
}

describe("McpManager.enforceTeamScopedArgs", () => {
    it("leaves non-team-scoped tools untouched", () => {
        const result = enforce("some_unrelated_tool", { foo: "bar" }, "team-1");
        expect(result).toEqual({ foo: "bar" });
    });

    describe("app-learning tools (team_id casing)", () => {
        it("fills in team_id from the real context teamId when the caller omits it", () => {
            const result = enforce("read_app_learning_memories", {}, "real-team");
            expect(result.team_id).toBe("real-team");
        });

        it("never adds a teamId (camelCase) key that would violate that tool's additionalProperties: false schema", () => {
            const result = enforce("read_app_learning_memories", {}, "real-team");
            expect("teamId" in result).toBe(false);
        });
    });

    describe("LinkedIn MCP tools (teamId casing) - OPEN-195", () => {
        it("fills in teamId from the real context teamId when the caller omits it", () => {
            const result = enforce(
                "queue_linkedin_action",
                { actionType: "CONNECT", profileUrl: "https://linkedin.com/in/x" },
                "real-team"
            );
            expect(result.teamId).toBe("real-team");
        });

        it("rejects a queue_linkedin_action call whose teamId doesn't match the real context team", () => {
            expect(() =>
                enforce(
                    "queue_linkedin_action",
                    { teamId: "victim-team", actionType: "CONNECT", profileUrl: "https://linkedin.com/in/x" },
                    "attacker-team"
                )
            ).toThrow(/teamId must match context.teamId/);
        });

        it("rejects a get_linkedin_task_status call whose teamId doesn't match the real context team", () => {
            expect(() =>
                enforce("get_linkedin_task_status", { taskId: "t1", teamId: "victim-team" }, "attacker-team")
            ).toThrow(/teamId must match context.teamId/);
        });

        it("rejects a get_linkedin_daily_cap call whose teamId doesn't match the real context team", () => {
            expect(() => enforce("get_linkedin_daily_cap", { teamId: "victim-team" }, "attacker-team")).toThrow(
                /teamId must match context.teamId/
            );
        });

        it("rejects a report_linkedin_stop call whose teamId doesn't match the real context team", () => {
            expect(() =>
                enforce("report_linkedin_stop", { teamId: "victim-team", stopReason: "MANUAL_STOP" }, "attacker-team")
            ).toThrow(/teamId must match context.teamId/);
        });

        it("throws when no real context teamId is available at all", () => {
            expect(() => enforce("queue_linkedin_action", { teamId: "victim-team" }, undefined)).toThrow(
                /requires context.teamId/
            );
        });

        it("never adds a team_id (snake_case) key not declared by the LinkedIn tool schemas", () => {
            const result = enforce("get_linkedin_daily_cap", {}, "real-team");
            expect("team_id" in result).toBe(false);
        });
    });
});
