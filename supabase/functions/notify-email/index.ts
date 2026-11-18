// Envoi des e-mails Batimatch :
//   • alertes (demande d'accès reçue, accès accepté, relance d'une entreprise, demande de connexion SSO pour l'administrateur) ;
//   • messages aux entreprises qui demandent le SSO (accusé de réception, réponses de l'administrateur).
// Appelée par la base (déclencheurs sur public.notifications et public.sso_messages) avec le seul
// identifiant de la ligne : la fonction la relit, la marque « envoyée » de façon atomique, puis expédie
// via Resend. Un appel extérieur ne peut donc ni choisir le destinataire, ni le contenu, ni renvoyer deux fois.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SITE = 'https://batimatch.paceapp.fr'
const FROM = 'Batimatch <batimatch@paceapp.fr>'
const REPLY_TO = 'contact@paceapp.fr'
const SANS = 'Arial,Helvetica,sans-serif'

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface Mail {
  subject: string
  preheader: string
  title: string
  subtitle: string
  bodyHtml: string
  cta: { label: string; url: string }
  reason: string
  text: string
  /** Adresse de réponse, si ce n'est pas le contact Batimatch */
  replyTo?: string
}

/** Même charte que les e-mails de connexion (supabase/emails/code.html) */
function layout(m: Mail): string {
  const pad = '&#847;&zwnj;&nbsp;'.repeat(20)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(m.subject)}</title>
<!--[if mso]><style>td,a,span,h1,p{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>@media (max-width:620px){.bm-pad{padding:28px 22px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#F3F5F8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(m.preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F5F8" style="background:#F3F5F8;"><tr><td align="center" style="padding:28px 12px 40px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
 <tr><td class="bm-pad" bgcolor="#1B2A3A" style="background:#1B2A3A;border-radius:14px 14px 0 0;padding:30px 40px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
   <td valign="bottom" style="padding-right:10px;">
    <table role="presentation" cellpadding="0" cellspacing="0" bgcolor="#F3F5F8" style="background:#F3F5F8;border-radius:6px;"><tr>
     <td valign="bottom" style="padding:6px 0 6px 6px;"><div style="width:5px;height:8px;background:#1B2A3A;font-size:0;line-height:0;">&nbsp;</div></td>
     <td valign="bottom" style="padding:6px 0 6px 3px;"><div style="width:5px;height:14px;background:#1B2A3A;font-size:0;line-height:0;">&nbsp;</div></td>
     <td valign="bottom" style="padding:6px 6px 6px 3px;"><div style="width:5px;height:19px;background:#F8E04E;font-size:0;line-height:0;">&nbsp;</div></td>
    </tr></table>
   </td>
   <td valign="middle" style="font:700 22px/24px 'Barlow Condensed','Arial Narrow',${SANS};color:#ffffff;">Batimatch<br><span style="font:400 11px/14px ${SANS};color:#AEBBC8;">by PaceApp</span></td>
  </tr></table>
  <h1 style="margin:26px 0 0;font:700 26px/32px ${SANS};color:#ffffff;">${esc(m.title)}</h1>
  <p style="margin:8px 0 0;font:400 15px/23px ${SANS};color:#C9D3DD;">${esc(m.subtitle)}</p>
 </td></tr>
 <tr><td class="bm-pad" bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 14px 14px;padding:32px 40px 34px;border:1px solid #D3DBE3;border-top:0;">
  ${m.bodyHtml}
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(m.cta.url)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="#2A5C8F"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${esc(m.cta.label)}</center></v:roundrect><![endif]-->
  <!--[if !mso]><!--><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2A5C8F" style="background:#2A5C8F;border-radius:8px;">
   <a href="${esc(m.cta.url)}" style="display:inline-block;padding:14px 28px;font:700 16px/20px ${SANS};color:#ffffff;text-decoration:none;border-radius:8px;">${esc(m.cta.label)}</a>
  </td></tr></table><!--<![endif]-->
 </td></tr>
 <tr><td style="padding:22px 16px 0;text-align:center;font:400 12px/19px ${SANS};color:#75838F;">
  Batimatch, consultations d'entreprises du BTP &nbsp;|&nbsp; <a href="${SITE}" style="color:#75838F;text-decoration:underline;">batimatch.paceapp.fr</a> &nbsp;|&nbsp; <a href="mailto:${REPLY_TO}" style="color:#75838F;text-decoration:underline;">Nous contacter</a><br>
  ${esc(m.reason)}
 </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:7px 0;font:400 13px/20px ${SANS};color:#75838F;width:110px;vertical-align:top;">${esc(label)}</td><td style="padding:7px 0;font:700 15px/22px ${SANS};color:#1B2A3A;">${esc(value)}</td></tr>`
const facts = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F5F8" style="background:#F3F5F8;border:1px solid #D3DBE3;border-radius:10px;"><tr><td style="padding:10px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.filter((r) => r[1]).map((r) => row(r[0], r[1])).join('')}</table></td></tr></table>`
const p = (html: string) => `<p style="margin:18px 0 0;font:400 15px/24px ${SANS};color:#46586A;">${html}</p>`

interface Notification {
  id: string
  user_id: string
  kind: string
  project_id: string | null
  lot_id: string | null
  data: { project?: string; lot?: string; company?: string; contact?: string; email?: string; phone?: string; users?: string; provider?: string; message?: string; buyer?: string; due?: string }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
/** Texte libre → paragraphes HTML échappés */
const paragraphs = (text: string) =>
  text.trim().split(/\n{2,}/).map((b) => p(esc(b).replace(/\n/g, '<br>'))).join('')

function compose(n: Notification): Mail | null {
  const project = n.data.project || 'votre projet'
  const lot = n.data.lot || 'un lot'
  const company = n.data.company || 'Une entreprise'
  if (n.kind === 'access_requested') {
    const url = `${SITE}/#/p/${n.project_id}`
    return {
      subject: `${company} demande l'accès au lot ${lot}`,
      preheader: `Projet ${project} : acceptez ou refusez la demande dans Batimatch.`,
      title: 'Nouvelle demande d’accès',
      subtitle: 'Une entreprise souhaite répondre à l’un de vos lots.',
      bodyHtml: facts([['Entreprise', company], ['Contact', n.data.contact ?? ''], ['Lot', lot], ['Projet', project]]) +
        p('Tant que vous n’avez pas accepté, l’entreprise ne voit ni la DPGF ni les autres offres.'),
      cta: { label: 'Voir la demande', url },
      reason: 'Vous recevez cet e-mail parce que vous êtes l’acheteur de ce projet sur Batimatch.',
      text: `${company} demande l'accès au lot ${lot} (projet ${project}).\nContact : ${n.data.contact ?? ''}\n\nAccepter ou refuser : ${url}`,
    }
  }
  if (n.kind === 'access_approved') {
    const url = `${SITE}/#/p/${n.project_id}/l/${n.lot_id}`
    return {
      subject: `Accès accepté : lot ${lot}, ${project}`,
      preheader: 'Vous pouvez maintenant consulter la DPGF et saisir votre offre.',
      title: 'Votre accès est accepté',
      subtitle: 'Vous pouvez consulter la DPGF et saisir votre offre.',
      bodyHtml: facts([['Lot', lot], ['Projet', project]]) +
        p('Votre offre reste modifiable jusqu’à la date de rendu indiquée sur le lot.'),
      cta: { label: 'Répondre au lot', url },
      reason: 'Vous recevez cet e-mail parce que vous avez demandé l’accès à ce lot sur Batimatch.',
      text: `Votre accès au lot ${lot} (projet ${project}) est accepté.\n\nRépondre au lot : ${url}`,
    }
  }
  if (n.kind === 'offer_reminder') {
    const url = `${SITE}/#/p/${n.project_id}/l/${n.lot_id}`
    const buyer = n.data.buyer || 'L’acheteur'
    const who = n.data.contact ? `${n.data.contact} (${buyer})` : buyer
    return {
      subject: `Relance : votre offre pour le lot ${lot}, ${project}`,
      preheader: `${who} attend votre offre${n.data.due ? ` avant le ${n.data.due}` : ''}.`,
      title: 'Votre offre est attendue',
      subtitle: `${who} vous relance sur Batimatch.`,
      bodyHtml: facts([['Projet', project], ['Lot', lot], ['Date de remise', n.data.due ?? ''], ['Demandé par', who]]) +
        p('Pour rappel, vous avez accès à ce lot et nous n’avons pas encore reçu votre offre. Le bouton ci-dessous vous amène directement à la DPGF à compléter.') +
        p('Si vous ne souhaitez pas répondre, vous pouvez l’indiquer sur la page du lot : l’acheteur en sera informé.'),
      cta: { label: 'Répondre à la DPGF', url },
      reason: 'Vous recevez cet e-mail parce que vous êtes accepté sur ce lot dans Batimatch et que l’acheteur vous a relancé.',
      text: `${who} vous relance : votre offre est attendue pour le lot ${lot} (projet ${project})${n.data.due ? `, avant le ${n.data.due}` : ''}.

Répondre à la DPGF : ${url}`,
      replyTo: n.data.email && EMAIL_RE.test(n.data.email) ? n.data.email : undefined,
    }
  }
  if (n.kind === 'sso_requested') {
    const url = `${SITE}/#/admin`
    const d = n.data
    const provider = d.provider === 'other' ? 'Autre fournisseur' : 'Microsoft Entra ID'
    return {
      subject: `Demande SSO : ${company}`,
      preheader: `${d.contact || company} demande la connexion SSO. Traitez la demande depuis le panneau admin.`,
      title: 'Nouvelle demande SSO',
      subtitle: 'Une entreprise souhaite se connecter à Batimatch avec ses comptes professionnels.',
      bodyHtml: facts([['Entreprise', company], ['Contact', d.contact ?? ''], ['E-mail', d.email ?? ''], ['Téléphone', d.phone ?? ''], ['Utilisateurs', d.users ?? ''], ['Annuaire', provider]]) +
        (d.message ? p(`<strong style="color:#1B2A3A;">Message :</strong><br>${esc(d.message).replace(/\n/g, '<br>')}`) : '') +
        p('Répondez, appelez et suivez l’activation depuis le panneau admin. Un accusé de réception est déjà parti vers l’entreprise.'),
      cta: { label: 'Traiter la demande', url },
      reason: 'Vous recevez cet e-mail parce que vous administrez Batimatch.',
      text: `${company} demande la connexion SSO.\nContact : ${d.contact ?? ''}\nE-mail : ${d.email ?? ''}\nTéléphone : ${d.phone ?? ''}\nUtilisateurs : ${d.users ?? ''}\nAnnuaire : ${provider}\n${d.message ? `Message : ${d.message}\n` : ''}\nTraiter la demande : ${url}`,
      replyTo: d.email && EMAIL_RE.test(d.email) ? d.email : undefined,
    }
  }
  return null
}

interface SsoMessage {
  id: string
  request_id: string
  kind: 'ack' | 'reply'
  subject: string
  body: string
}

/** E-mail destiné à l'entreprise qui a demandé le SSO */
function composeSso(m: SsoMessage): Mail {
  const reason = 'Vous recevez cet e-mail parce qu’une demande de connexion SSO a été déposée avec cette adresse sur Batimatch.'
  if (m.kind === 'ack') {
    // Texte fixe, sans aucune donnée saisie dans le formulaire
    return {
      subject: 'Votre demande de connexion SSO Batimatch est bien reçue',
      preheader: 'Nous revenons vers vous pour préparer l’activation avec votre service informatique.',
      title: 'Demande bien reçue',
      subtitle: 'Connexion SSO à Batimatch avec vos comptes professionnels.',
      bodyHtml:
        p('Bonjour,').replace('margin:18px 0 0', 'margin:0') +
        p('Nous avons bien reçu votre demande de connexion SSO (authentification unique). Nous revenons vers vous rapidement pour préparer l’activation avec votre service informatique.') +
        p('Avec le SSO, vos collaborateurs se connectent à Batimatch avec leur compte professionnel : aucun mot de passe supplémentaire, et un compte désactivé dans votre annuaire ne peut plus se connecter.') +
        p('Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.'),
      cta: { label: 'Découvrir Batimatch', url: SITE },
      reason,
      text: `Bonjour,\n\nNous avons bien reçu votre demande de connexion SSO à Batimatch. Nous revenons vers vous rapidement pour préparer l'activation avec votre service informatique.\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\n${SITE}`,
    }
  }
  return {
    subject: m.subject.trim(),
    preheader: m.body.trim().replace(/\s+/g, ' ').slice(0, 110),
    title: 'Votre connexion SSO Batimatch',
    subtitle: 'Suite de votre demande de connexion avec vos comptes professionnels.',
    bodyHtml: paragraphs(m.body).replace('margin:18px 0 0', 'margin:0'),
    cta: { label: 'Ouvrir Batimatch', url: SITE },
    reason,
    text: `${m.body.trim()}\n\n${SITE}`,
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const payload = await req.json().catch(() => ({}))
  const ssoId = payload?.sso_message
  const id = ssoId ?? payload?.id
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'id' }, 400)

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return json({ error: 'RESEND_API_KEY manquante' }, 500)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const send = (to: string, mail: Mail) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: mail.replyTo ?? REPLY_TO, subject: mail.subject, html: layout(mail), text: mail.text }),
    })

  // Message à une entreprise qui a demandé le SSO : même verrou, le destinataire est celui de la demande
  if (ssoId) {
    const { data: m } = await sb
      .from('sso_messages')
      .update({ emailed_at: new Date().toISOString() })
      .eq('id', id)
      .is('emailed_at', null)
      .gte('created_at', since)
      .select('id, request_id, kind, subject, body')
      .maybeSingle()
    if (!m) return json({ sent: false })
    const { data: r } = await sb.from('sso_requests').select('email').eq('id', m.request_id).maybeSingle()
    if (!r?.email || !EMAIL_RE.test(r.email)) return json({ sent: false })
    const res = await send(r.email, composeSso(m as SsoMessage))
    if (!res.ok) {
      await sb.from('sso_messages').update({ emailed_at: null }).eq('id', id)
      return json({ error: 'resend', status: res.status, detail: await res.text() }, 502)
    }
    return json({ sent: true })
  }

  // Verrou : une alerte récente, d'un type envoyé par e-mail, pas encore expédiée
  const { data: n } = await sb
    .from('notifications')
    .update({ emailed_at: new Date().toISOString() })
    .eq('id', id)
    .is('emailed_at', null)
    .in('kind', ['access_requested', 'access_approved', 'sso_requested', 'offer_reminder'])
    .gte('created_at', since)
    .select('id, user_id, kind, project_id, lot_id, data')
    .maybeSingle()
  if (!n) return json({ sent: false })

  const release = () => sb.from('notifications').update({ emailed_at: null }).eq('id', id)
  const mail = compose(n as Notification)
  const { data: u } = await sb.auth.admin.getUserById(n.user_id)
  const to = u?.user?.email
  if (!mail || !to) return json({ sent: false })

  const res = await send(to, mail)
  if (!res.ok) {
    await release()
    return json({ error: 'resend', status: res.status, detail: await res.text() }, 502)
  }
  return json({ sent: true })
})
