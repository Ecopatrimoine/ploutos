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
  type: "welcome_trial" | "licence_activated" | "trial_expiring";
  cabinet_name?: string;
  trial_end?: string;
}

function getEmailContent(payload: EmailPayload): { subject: string; html: string } {
  const name = payload.cabinet_name || "votre cabinet";

  switch (payload.type) {

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
