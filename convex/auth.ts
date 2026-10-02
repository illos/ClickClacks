// SPDX-License-Identifier: MIT
import {Password} from "@convex-dev/auth/providers/Password";
import {convexAuth} from "@convex-dev/auth/server";
import {ConvexError} from "convex/values";

// Existing accounts unlock anonymous summaries; new account creation is closed.
export const {auth, signIn, signOut, store, isAuthenticated} = convexAuth({
  providers: [Password({profile(params) {
    if (params.flow !== "signIn")
      throw new ConvexError("Account registration is closed.");
    const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new ConvexError("Enter a valid email address.");
    return {email};
  }})],
});
