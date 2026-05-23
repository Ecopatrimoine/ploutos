// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Ploutos <contact@ploutos-cgp.fr>";

const LOGO_SRC = "https://app.ploutos-cgp.fr/logo.ploutos.lettrage.svg";

const HEADER = `
  <div style="background:#FBECD7;padding:28px 32px;text-align:center;border-bottom:3px solid #E3AF64">
    <img src="${LOGO_SRC}" alt="Ploutos" style="height:80px;width:auto;object-fit:contain" />
  </div>`;

const FOOTER = `
  <div style="padding:16px 32px;background:#f5f0e8;text-align:center">
    <p style="color:#888;font-size:12px;margin:0">© Ploutos 2026 — EcoPatrimoine Conseil · <a href="https://ploutos-cgp.fr" style="color:#26428B">ploutos-cgp.fr</a></p>
  </div>`;

interface EmailPayload {
  to: string;
  type: "welcome_trial" | "welcome_trial_mac" | "licence_activated" | "trial_expiring" | "demo_invite" | "trial_feedback";
  cabinet_name?: string;
  trial_end?: string;
  first_name?: string;
  cal_link?: string;
  trial_link?: string;
  monthly_link?: string;
  annual_link?: string;
  feedback_link?: string;
}

function getEmailContent(payload: EmailPayload): { subject: string; html: string } {
  const name = payload.cabinet_name || "votre cabinet";

  switch (payload.type) {

    case "welcome_trial_mac":
      return {
        subject: "Bienvenue sur Ploutos — comment lancer l'app sur Mac",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#101B3B">
            ${HEADER}
            <div style="padding:32px;background:#fff">
              <h2 style="color:#101B3B">Bienvenue sur Ploutos !</h2>
              <p>Votre compte pour <strong>${name}</strong> a bien été créé.</p>
              <p>Vous bénéficiez d'un <strong>essai gratuit de 15 jours</strong> avec accès à toutes les fonctionnalités.</p>

              <div style="background:#FBECD7;border-left:4px solid #E3AF64;border-radius:8px;padding:20px 24px;margin:24px 0">
                <p style="font-weight:bold;color:#101B3B;margin:0 0 12px">📦 Installer Ploutos sur Mac — 3 étapes</p>
                <div style="display:flex;align-items:flex-start;margin-bottom:12px">
                  <div style="background:#101B3B;color:#E3AF64;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:1px">1</div>
                  <div>
                    <strong>Téléchargez le fichier .dmg</strong> depuis la page de téléchargement<br>
                    <a href="https://ploutos-cgp.fr#telechargements" style="color:#26428B;font-size:13px">ploutos-cgp.fr → section Téléchargements → macOS</a>
                  </div>
                </div>
                <div style="display:flex;align-items:flex-start;margin-bottom:12px">
                  <div style="background:#101B3B;color:#E3AF64;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:1px">2</div>
                  <div>
                    <strong>Clic droit sur le fichier Ploutos.dmg → Ouvrir</strong><br>
                    <span style="color:#666;font-size:13px">⚠️ Ne pas double-cliquer — utiliser impérativement le clic droit</span>
                  </div>
                </div>
                <div style="display:flex;align-items:flex-start">
                  <div style="background:#101B3B;color:#E3AF64;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:1px">3</div>
                  <div>
                    <strong>Dans le popup de sécurité Apple → cliquer "Ouvrir"</strong><br>
                    <span style="color:#666;font-size:13px">Cette confirmation n'est demandée qu'une seule fois. Les mises à jour suivantes s'installent automatiquement.</span>
                  </div>
                </div>
              </div>

              <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:20px 0">
                <p style="margin:0;font-size:13px;color:#26428B">
                  <strong>Pourquoi ce message ?</strong> L'application n'est pas encore certifiée Apple Developer (programme payant). Cette procédure clic droit est standard pour toute application indépendante sur Mac — elle est sûre et ne se répète pas.
                </p>
              </div>

              <p>Une fois l'app ouverte, connectez-vous avec vos identifiants pour retrouver tous vos dossiers synchronisés.</p>

              <div style="text-align:center;margin:32px 0">
                <a href="https://app.ploutos-cgp.fr" style="background:#101B3B;color:#E3AF64;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  Accéder à Ploutos web →
                </a>
              </div>

              <p style="color:#888;font-size:13px">Un problème à l'installation ? Répondez à cet email, nous vous guidons en moins de 24h.</p>
            </div>
            ${FOOTER}
          </div>`
      };

    case "welcome_trial":
      return {
        subject: "Bienvenue sur Ploutos — votre essai de 15 jours commence",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#101B3B">
            ${HEADER}
            <div style="padding:32px;background:#fff">
              <h2 style="color:#101B3B">Bienvenue sur Ploutos !</h2>
              <p>Votre compte pour <strong>${name}</strong> a bien été créé.</p>
              <p>Vous bénéficiez d'un <strong>essai gratuit de 15 jours</strong> avec accès à toutes les fonctionnalités :</p>
              <ul style="color:#26428B;line-height:2">
                <li>Calculs IR, IFI, Succession (revenus 2025)</li>
                <li>Rapports PDF aux couleurs de votre cabinet</li>
                <li>Gestion multi-clients illimitée</li>
                <li>Synchronisation multi-appareils</li>
              </ul>
              <div style="text-align:center;margin:32px 0">
                <a href="https://app.ploutos-cgp.fr" style="background:#101B3B;color:#E3AF64;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  Accéder à Ploutos →
                </a>
              </div>
              <p style="color:#888;font-size:13px">Une question ? Répondez à cet email ou contactez-nous à <a href="mailto:contact@ploutos-cgp.fr" style="color:#26428B">contact@ploutos-cgp.fr</a></p>
            </div>
            ${FOOTER}
          </div>`
      };

    case "licence_activated":
      return {
        subject: "Votre abonnement Ploutos est actif — merci !",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#101B3B">
            ${HEADER}
            <div style="padding:32px;background:#fff">
              <h2 style="color:#101B3B">Votre abonnement est activé ✓</h2>
              <p>Merci pour votre confiance. L'abonnement de <strong>${name}</strong> est maintenant actif.</p>
              <p>Vous avez accès à toutes les fonctionnalités Ploutos sans limitation :</p>
              <ul style="color:#26428B;line-height:2">
                <li>Calculs IR, IFI, Succession (revenus 2025)</li>
                <li>Rapports PDF aux couleurs de votre cabinet</li>
                <li>Gestion multi-clients illimitée</li>
                <li>Synchronisation multi-appareils (Web + Windows)</li>
                <li>Mises à jour automatiques incluses</li>
              </ul>
              <div style="text-align:center;margin:32px 0">
                <a href="https://app.ploutos-cgp.fr" style="background:#101B3B;color:#E3AF64;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  Accéder à Ploutos →
                </a>
              </div>
              <p style="color:#888;font-size:13px">Pour gérer votre abonnement (annulation, changement de carte), contactez-nous à <a href="mailto:contact@ploutos-cgp.fr" style="color:#26428B">contact@ploutos-cgp.fr</a></p>
            </div>
            ${FOOTER}
          </div>`
      };

    case "trial_expiring":
      return {
        subject: "Votre essai Ploutos se termine dans 3 jours",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#101B3B">
            ${HEADER}
            <div style="padding:32px;background:#fff">
              <h2 style="color:#101B3B">Votre essai se termine bientôt</h2>
              <p>L'essai gratuit de <strong>${name}</strong> se termine dans <strong>3 jours</strong>.</p>
              <p>Pour continuer à utiliser Ploutos sans interruption, souscrivez un abonnement :</p>
              <div style="margin:24px 0">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="48%" style="border:2px solid #E3AF64;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
                      <div style="font-weight:bold;color:#101B3B;margin-bottom:8px">Mensuel</div>
                      <div style="font-size:28px;font-weight:bold;color:#101B3B;font-family:Georgia,serif">50 €<span style="font-size:15px;font-weight:normal;color:#888">/mois</span></div>
                      <div style="font-size:12px;color:#999;margin-top:4px">Sans engagement</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="border:2px solid #101B3B;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
                      <div style="font-weight:bold;color:#101B3B;margin-bottom:8px">Annuel</div>
                      <div style="font-size:28px;font-weight:bold;color:#101B3B;font-family:Georgia,serif">500 €<span style="font-size:15px;font-weight:normal;color:#888">/an</span></div>
                      <div style="font-size:12px;color:#C9A84C;font-weight:bold;margin-top:4px">2 mois offerts</div>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="text-align:center;margin:32px 0">
                <a href="https://app.ploutos-cgp.fr" style="background:#101B3B;color:#E3AF64;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  Choisir mon abonnement →
                </a>
              </div>
            </div>
            ${FOOTER}
          </div>`
      };

    // ── Nouveaux types tunnel commercial ──────────────────────────────────────

    case "demo_invite": {
      const firstName = payload.first_name || name;
      const calLink   = payload.cal_link || "https://cal.com/david-perry-ecopatrimoine-conseil-ftutid";
      return {
        subject: "Votre essai Ploutos est actif 📂",
        html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ECEAE5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECEAE5;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
  <tr>
    <td style="background-color:#101B3B;border-radius:10px 10px 0 0;padding:22px 44px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <img src="${LOGO_SRC}" height="28" alt="PLOUTOS" style="display:block;height:28px;width:auto;" />
        </td>
        <td align="right" style="vertical-align:middle;">
          <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#3A5468;letter-spacing:2px;text-transform:uppercase;">Gestion patrimoniale</span>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="background-color:#C9A84C;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr>
    <td style="background-color:#FFFFFF;padding:44px 44px 40px;">
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#101B3B;margin:0 0 18px 0;">Bonjour ${firstName},</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;">
        <tr><td style="background-color:#EAF4EC;border:1px solid #5AAF6A;border-radius:20px;padding:7px 18px;">
          <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#2E7D32;font-weight:bold;">● Essai actif — 15 jours</span>
        </td></tr>
      </table>
      <p style="font-family:Georgia,serif;font-size:17px;color:#101B3B;line-height:1.5;margin:0 0 18px 0;font-style:italic;">Votre accès est actif — bienvenue sur Ploutos.</p>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#3D3D3D;line-height:1.85;margin:0 0 30px 0;">
        Pour démarrer sans se perdre, chaque écran dispose de <strong style="color:#101B3B;">tooltips contextuels</strong>
        et d'un <strong style="color:#101B3B;">bouton Aide</strong> qui vous guide pas à pas.
        L'idée c'est que vous puissiez vous repérer seul en quelques minutes, sans documentation extérieure.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#101B3B;border-radius:6px;">
        <tr><td style="padding:22px 28px;">
          <p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:0 0 10px 0;">Vous préférez un tour guidé ?</p>
          <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#94AFBE;line-height:1.75;margin:0 0 18px 0;">
            Je propose des démos en visio de 30 minutes — l'occasion de poser vos questions et de voir comment Ploutos s'intègre à votre fonctionnement.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background-color:#C9A84C;border-radius:4px;">
              <a href="${calLink}" style="display:block;padding:12px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:bold;color:#101B3B;text-decoration:none;">Réserver une démo →</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#9A9A9A;margin:28px 0 0 0;">Bonne exploration,</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#101B3B;border-radius:0 0 10px 10px;padding:22px 44px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#FFFFFF;margin:0 0 2px 0;font-weight:600;">David Perry</p>
        <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#3A5468;margin:0;">EcoPatrimoine Conseil</p></td>
        <td align="right"><a href="mailto:contact@ecopatrimoine-conseil.com" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#C9A84C;text-decoration:none;">contact@ecopatrimoine-conseil.com</a></td>
      </tr></table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`
      };
    }

    case "trial_feedback": {
      const firstName    = payload.first_name || name;
      const monthlyLink  = payload.monthly_link || "https://app.ploutos-cgp.fr";
      const annualLink   = payload.annual_link  || "https://app.ploutos-cgp.fr";
      const feedbackLink = payload.feedback_link || "https://app.ploutos-cgp.fr";
      return {
        subject: "Et Ploutos, qu'en avez-vous pensé ?",
        html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ECEAE5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECEAE5;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
  <tr>
    <td style="background-color:#101B3B;border-radius:10px 10px 0 0;padding:22px 44px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <img src="${LOGO_SRC}" height="28" alt="PLOUTOS" style="display:block;height:28px;width:auto;" />
        </td>
        <td align="right" style="vertical-align:middle;">
          <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#3A5468;letter-spacing:2px;text-transform:uppercase;">Gestion patrimoniale</span>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="background-color:#C9A84C;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr>
    <td style="background-color:#FFFFFF;padding:44px 44px 40px;">
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#101B3B;margin:0 0 24px 0;">Bonjour ${firstName},</p>
      <p style="font-family:Georgia,serif;font-size:17px;color:#101B3B;line-height:1.5;margin:0 0 16px 0;font-style:italic;">Votre essai Ploutos s'est terminé il y a quelques jours.</p>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#3D3D3D;line-height:1.85;margin:0 0 30px 0;">
        J'espère que vous avez eu le temps d'explorer un peu — mais si ce n'est pas le cas, pas de problème,
        c'est souvent le quotidien du cabinet qui prend le dessus.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#101B3B;border-radius:6px;margin:0 0 26px 0;">
        <tr><td style="padding:22px 28px;">
          <p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:0 0 18px 0;">Continuer avec Ploutos</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:50%;padding-right:6px;">
              <a href="${monthlyLink}" style="display:block;text-align:center;padding:12px;background-color:#C9A84C;border-radius:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:bold;color:#101B3B;text-decoration:none;">50 €/mois</a>
              <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#4A6275;text-align:center;margin:5px 0 0 0;">Sans engagement</p>
            </td>
            <td style="width:50%;padding-left:6px;">
              <a href="${annualLink}" style="display:block;text-align:center;padding:12px;border:1px solid #C9A84C;border-radius:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:bold;color:#C9A84C;text-decoration:none;">500 €/an</a>
              <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#4A6275;text-align:center;margin:5px 0 0 0;">2 mois offerts</p>
            </td>
          </tr></table>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #C9A84C;background-color:#F7F4EF;border-radius:0 5px 5px 0;margin:0 0 24px 0;">
        <tr><td style="padding:20px 22px;">
          <p style="font-family:Georgia,serif;font-size:14px;color:#101B3B;margin:0 0 8px 0;">Votre avis m'intéresse vraiment</p>
          <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5A5A5A;line-height:1.8;margin:0 0 12px 0;">
            Que vous continuiez ou non — ce que vous avez aimé, ce qui manquait, ce qui ne correspondait pas. C'est comme ça qu'on améliore le produit.
          </p>
          <a href="${feedbackLink}" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#C9A84C;text-decoration:none;font-weight:bold;">Remplir le formulaire (2 minutes) →</a>
        </td></tr>
      </table>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5A5A5A;line-height:1.8;margin:0 0 22px 0;">
        Je me permettrai également de vous appeler directement dans les prochains jours —
        mais si vous préférez répondre à votre rythme, le formulaire est là pour ça.
      </p>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#9A9A9A;margin:0;">Merci d'avoir testé.</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#101B3B;border-radius:0 0 10px 10px;padding:22px 44px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#FFFFFF;margin:0 0 2px 0;font-weight:600;">David Perry</p>
        <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#3A5468;margin:0;">EcoPatrimoine Conseil</p></td>
        <td align="right"><a href="mailto:contact@ecopatrimoine-conseil.com" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#C9A84C;text-decoration:none;">contact@ecopatrimoine-conseil.com</a></td>
      </tr></table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`
      };
    }
  }
}

serve(async (req) => {
  try {
    const payload: EmailPayload = await req.json();

    if (!payload.to || !payload.type) {
      return new Response(JSON.stringify({ error: "Missing to or type" }), { status: 400 });
    }

    const { subject, html } = getEmailContent(payload);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: payload.to, subject, html, reply_to: "contact@ecopatrimoine-conseil.com" }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: data }), { status: 500 });
    }

    console.log(`✅ Email ${payload.type} envoyé à ${payload.to}`);
    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 });

  } catch (err) {
    console.error("Erreur send-email:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
