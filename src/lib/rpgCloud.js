import { supabase } from "./supabaseClient";

export const rpgCloudEnabled = Boolean(supabase);

async function withTimeout(request, timeout = 12000) {
  let timer;
  try {
    return await Promise.race([
      request,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Supabase request timed out")), timeout);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function signUpPlayer({ name, email, password }) {
  const { data, error } = await withTimeout(supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } }
  }));

  if (error) throw error;
  return data;
}

export async function signInPlayer({ email, password }) {
  const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
  if (error) throw error;
  return data;
}

export async function signOutPlayer() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadPlayerAccount(user, createFallback) {
  const { data, error } = await withTimeout(supabase
    .from("rpg_player_data")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle());

  if (error) throw error;
  if (data?.data) return { ...data.data, id: user.id, email: user.email };

  const account = createFallback();
  await savePlayerAccount(account, user.id);
  return account;
}

export async function savePlayerAccount(account, userId) {
  const { password: _password, ...safeAccount } = account;
  const { error } = await withTimeout(supabase.from("rpg_player_data").upsert({
    user_id: userId,
    data: { ...safeAccount, id: userId },
    updated_at: new Date().toISOString()
  }));

  if (error) throw error;
}

export function observeAuth(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      void callback(session);
    }, 0);
  });
}

export async function getCurrentSession() {
  const { data, error } = await withTimeout(supabase.auth.getSession());
  if (error) throw error;
  return data.session;
}
