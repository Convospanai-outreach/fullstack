import { vi, Mock, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockAuth, mockCurrentUser, mockIsSsoEnforcedForEmail } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
        userInvitation: { findFirst: vi.fn() },
        inviteRequest: { findFirst: vi.fn() },
    },
    mockAuth: vi.fn(),
    mockCurrentUser: vi.fn(),
    mockIsSsoEnforcedForEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth, currentUser: mockCurrentUser }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: mockIsSsoEnforcedForEmail }));
vi.mock("@/lib/invitations", () => ({ findValidInvitation: vi.fn(), isAssignableInviteRole: vi.fn() }));

import { findOrCreateClerkAppUser } from "../clerkAuth";

describe("findOrCreateClerkAppUser - SSO enforcement (OPEN-113)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ userId: "clerk-1" });
    });

    it("denies access for an already-linked user whose domain now has SSO enforced", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            email: "user@enterprise.com",
            memberships: [],
        });
        mockIsSsoEnforcedForEmail.mockResolvedValue(true);

        const result = await findOrCreateClerkAppUser();

        expect(result).toBeNull();
        expect(mockIsSsoEnforcedForEmail).toHaveBeenCalledWith("user@enterprise.com");
        expect(mockCurrentUser).not.toHaveBeenCalled();
    });

    it("returns the already-linked user when their domain has no SSO enforcement", async () => {
        const user = { id: "user-1", email: "user@example.com", memberships: [] };
        mockPrisma.user.findUnique.mockResolvedValue(user);
        mockIsSsoEnforcedForEmail.mockResolvedValue(false);

        const result = await findOrCreateClerkAppUser();

        expect(result).toEqual(user);
    });

    it("denies provisioning a brand-new user whose domain has SSO enforced", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockCurrentUser.mockResolvedValue({
            emailAddresses: [{ id: "e1", emailAddress: "new@enterprise.com", verification: { status: "verified" } }],
            primaryEmailAddressId: "e1",
            unsafeMetadata: {},
        });
        mockIsSsoEnforcedForEmail.mockResolvedValue(true);

        const result = await findOrCreateClerkAppUser();

        expect(result).toBeNull();
        expect(mockIsSsoEnforcedForEmail).toHaveBeenCalledWith("new@enterprise.com");
        expect(mockPrisma.userInvitation.findFirst).not.toHaveBeenCalled();
    });
});
