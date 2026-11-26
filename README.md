# Lázeňský plán

Mobilní PWA pro denní přehled lázeňských procedur. Čistě statická stránka (HTML, CSS, JavaScript) — bez buildu a bez backendu. Funguje offline po první návštěvě a jde uložit na plochu telefonu.

## Úprava dat

Všechny procedury jsou v souboru [`data/procedures.json`](data/procedures.json).

Každá položka má tvar:

```json
{
  "date": "2026-11-26",
  "time": "10:30",
  "name": "Skup. cvičení vertebro",
  "place": "Polárka",
  "staff": "Mgr. Vardanyan Zaruhi",
  "type": "cviceni",
  "note": ""
}
```

- `date` — den v ISO formátu `YYYY-MM-DD`
- `time` — začátek `HH:MM` (délka procedury se nezadává a aplikace ji nepoužívá)
- `name`, `place` — název a místo
- `staff` — personál; prázdný řetězec se v UI nezobrazí
- `note` — poznámka; prázdný řetězec se nezobrazí
- `type` — ikona: `elektro`, `bazen`, `fyzio`, `cviceni`, `chodnik`, `koupel`, `zabal`, `vizita`, `krio` (Polarium / kriokomora, ledově modrá vločka)

Po úpravě souboru stačí znovu načíst stránku. Service worker používá strategii *stale-while-revalidate*: nejprve ukáže uložená data a na pozadí stáhne nová, takže se změny projeví při dalším načtení nebo po chvíli.

## Nasazení na GitHub Pages

1. Nahrajte tento adresář do repositáře na GitHubu.
2. **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch**
4. Branch: **main**, složka: **/ (root)**
5. Uložte a otevřete vygenerovanou URL.

Cesty v `manifest.json` (`start_url`, `scope`) a odkazy v HTML jsou relativní (`./`), takže aplikace funguje i v podsložce (`https://uzivatel.github.io/nazev-repozitare/`).

## Přidat na plochu

**iPhone (Safari)**  
Otevřete stránku → tlačítko **Sdílet** → **Přidat na plochu**.

**Android (Chrome)**  
Otevřete stránku → nabídka → **Nainstalovat aplikaci** (nebo **Přidat na plochu**).
