import { supabase } from "../../../utils/supabaseClient";

/**
 * Registers a new user with Supabase authentication.
 */
export const signUpService = async (email: string, password: string) => {
  return await supabase.auth.signUp({ email, password });
};

/**
 * Logs in an existing user using Supabase authentication.
 */
export const loginService = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

/**
 * Verifies user authentication using session token.
 */
export const verifyUserService = async (token: string) => {
  return await supabase.auth.getUser(token);
};
