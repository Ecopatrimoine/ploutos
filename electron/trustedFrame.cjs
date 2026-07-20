// electron/trustedFrame.cjs
//
// Module PUR (string-in / bool-out) : aucune dependance a electron, donc
// testable en isolation (vitest). Determine si la frame appelante d'un IPC est
// autorisee a invoquer les handlers du main process.
//
// Allowlist :
//   - meme origine que l'app distante (appUrl, ex. https://app.ploutos-cgp.fr) ;
//   - http://localhost:5173 UNIQUEMENT en dev (isDev passe en parametre — le
//     module ne lit aucun env, la decision dev/prod appartient a l'appelant).
// Tout le reste (https tierce, file://, url absente/malformee) -> non fiable.

const DEV_ORIGIN = "http://localhost:5173";

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null; // url absente ou malformee
  }
}

function isTrustedFrameUrl(frameUrl, options) {
  const opts = options || {};
  const frameOrigin = originOf(frameUrl);
  if (frameOrigin === null) return false;

  const appOrigin = originOf(opts.appUrl);
  if (appOrigin !== null && frameOrigin === appOrigin) return true;

  if (opts.isDev === true && frameOrigin === DEV_ORIGIN) return true;

  return false;
}

module.exports = { isTrustedFrameUrl };
