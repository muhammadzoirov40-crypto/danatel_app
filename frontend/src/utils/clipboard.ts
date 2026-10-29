/**
 * 📋 Нусхабардории матн — бо БАРҚАРАРСОЗӢ барои HTTP.
 *
 * Дар HTTPS `navigator.clipboard` кор мекунад. Лекин дар HTTP
 * (масалан, `http://37.27.245.216`) ин API муайян НЕСТ (secure context
 * лозим аст) → `navigator.clipboard.writeText` меафтомад ва тугмаи
 * «Нусха» кор намекард (талаби соҳиб, 29.10.2026). Аккун агар clipboard
 * дастрас набошад, аз `document.execCommand("copy")` истифода мебарем.
 *
 * @returns `true` агар нусхабардорӣ муваффақ шавад.
 */
export async function copyText(text: string): Promise<boolean> {
  // 1) Роҳи муосир (HTTPS / localhost)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* иҷозат додан рад шуд ё secure context нест → ба fallback */
  }

  // 2) Fallback барои HTTP: textarea ғайримоҳӣ + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
