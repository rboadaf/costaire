# Costair€ v9 REData

La pestanya **API** ara usa l'endpoint públic REData:

`/es/datos/mercados/precios-mercados-tiempo-real`

Paràmetres generats automàticament per al dia actual:

- `start_date=YYYY-MM-DDT00:00`
- `end_date=YYYY-MM-DDT23:59`
- `time_trunc=hour`
- `geo_ids=8741`

Costair€ llegeix els valors horaris del JSON i converteix €/MWh a €/kWh quan el valor és superior a 1.

Puja com a mínim:

- `index.html`
- `app.js`
- `sw.js`

Obre després `https://rboadaf.github.io/costaire/?v=9`.
