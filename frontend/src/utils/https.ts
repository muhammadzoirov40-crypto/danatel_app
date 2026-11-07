/** Линки HTTPS барои ин мизоҷ (IP → donatshop.<ip-dashes>.sslip.io).

 *  Пештар дар FaceAuthModal буд — 07.11.2026 ҳангоми нест кардани
 *  Face ID ба ин ҷо кӯчонида шуд (InstallApp + SidebarMenu истифода мебаранд).
 */
export function httpsUrl(): string {
  try {
    const u = new URL(window.location.href);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      u.hostname = `donatshop.${u.hostname.replace(/\./g, "-")}.sslip.io`;
    }
    u.protocol = "https:";
    return u.toString();
  } catch {
    return "https://donatshop.37-27-245-216.sslip.io/";
  }
}
