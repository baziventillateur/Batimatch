# E-mails d'authentification Batimatch

À coller dans Supabase : Authentication > Emails > Templates.

| Modèle Supabase | Objet | Corps |
|---|---|---|
| Magic Link | `{{ .Token }} est votre code Batimatch` | `code.html` |
| Confirm signup | `{{ .Token }} est votre code Batimatch` | `code.html` |

Le même fichier sert aux deux : le premier code d'un nouveau compte part avec « Confirm signup »,
les suivants avec « Magic Link ».

Choix pour limiter le classement en indésirable (repris des e-mails PaceApp) :
structure en tableaux et styles en ligne, aucune image ni lien de suivi, pré-en-tête masqué,
couleurs pleines (pas de fond dégradé seul), pied indiquant pourquoi le message est reçu et un contact.
L'expéditeur doit être une adresse du domaine paceapp.fr envoyée par le SMTP Resend (SPF/DKIM déjà en place).
