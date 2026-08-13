# Costair€ - PWA de cost dels aires

Versió v7.

## Lectura correcta del fitxer ESIOS

Per als `.xls` d'ESIOS **PVPC Término de facturación energía activa – Desglose**, Costair€ ja no intenta interpretar tot l'arxiu.

Ara fa exactament això:

- obre la pestanya **Tabla de Datos PCB**;
- llegeix només les cel·les **E6:E29**;
- interpreta cada fila com una hora del dia:
  - E6 = 00:00
  - E7 = 01:00
  - ...
  - E21 = 15:00
  - E29 = 23:00
- converteix els valors de **€/MWh** a **€/kWh** dividint per 1000.

Exemple: E21 = 68,0622325465 €/MWh → 0,06806 €/kWh a les 15:00.

Aquesta versió carrega SheetJS des de CDN per poder llegir `.xls` directament al navegador.

La cache del service worker és `costaire-v7`.
