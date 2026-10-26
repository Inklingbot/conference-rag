import {
  createClient,
  type User,
} from "npm:@supabase/supabase-js@2";

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<User> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthenticationError("Missing bearer token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthenticationError("Invalid or expired bearer token");
  }

  return user;
}
