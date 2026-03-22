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
  type: "welcome_trial" | "welcome_trial_mac" | "licence_activated" | "trial_expiring";
  cabinet_name?: string;
  trial_end?: string;
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
                      <div style="font-weight:bold;color:#26428B;margin-bottom:8px">Plan Solo</div>
                      <div style="font-size:24px;font-weight:bold;color:#101B3B">30 €<span style="font-size:14px;font-weight:normal;color:#888">/mois</span></div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="border:2px solid #101B3B;border-radius:12px;padding:20px;text-align:center;vertical-align:top">
                      <div style="font-weight:bold;color:#26428B;margin-bottom:8px">Plan Annuel</div>
                      <div style="font-size:24px;font-weight:bold;color:#101B3B">25 €<span style="font-size:14px;font-weight:normal;color:#888">/mois</span></div>
                      <div style="font-size:12px;color:#888">300 €/an · 2 mois offerts</div>
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
      body: JSON.stringify({ from: FROM, to: payload.to, subject, html }),
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
