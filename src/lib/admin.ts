/**
 * Comptes qui voient le panneau admin (menu « Mon compte »).
 * Contrôle d'affichage uniquement : le code est public dans le build, donc rien de sensible ne doit y figurer.
 * Les données restent protégées par les règles Supabase (RLS).
 */
const ADMIN_EMAILS = ['baziventillateur@gmail.com']

export const isAdminEmail = (email: string | null | undefined) => !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase())
