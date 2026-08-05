import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { UsersRepository } from "./users.repository";

const ROLE_MANAGER_ROLES = new Set(["owner", "super_administrator"]);

/**
 * Mirrors the frontend's rbac.ts permission model (manage_users is granted
 * to owner/super_administrator only) — duplicated here deliberately, not
 * imported, since the two apps don't share a types package yet (see the
 * infra doc's packages/contracts note for the long-term fix). The frontend
 * hiding a button is UX, not security: this check is what actually stops an
 * authenticated-but-unprivileged user from calling the endpoint directly.
 */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async changeRole(actorId: string, targetUserId: string, newRole: string, ctx: RequestContext) {
    // Re-fetched from DB rather than trusted off the actor's JWT claim: a
    // role change should take effect immediately, not just once the actor's
    // current (possibly already-stale, up to 10 minutes old) access token
    // happens to expire.
    const actor = await this.repo.findById(actorId);
    if (!actor || !ROLE_MANAGER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot manage user roles." });
    }
    // Granting "owner" is reserved to existing owners — a super_administrator
    // promoting themselves (or anyone) straight to owner would be a
    // privilege escalation one level beyond what their own role permits.
    if (newRole === "owner" && actor.role !== "owner") {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only an owner can grant the owner role." });
    }

    const target = await this.repo.findById(targetUserId);
    if (!target) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }

    const updated = await this.repo.updateRole(targetUserId, newRole);
    await this.repo.writeAuditLog({
      actorId,
      action: "user.role_changed",
      target: `${targetUserId}:${target.role}->${newRole}`,
      ip: ctx.ip,
    });

    return { id: updated.id, email: updated.email, username: updated.username, role: updated.role };
  }
}
