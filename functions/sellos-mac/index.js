const root = '/sellos-mac';
const headers = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
const json = (data, status = 200) => Response.json(data, { status, headers });
const validCode = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

function seasonInfo(now, startMonth = '1') {
  const start = Number(startMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw new Error('Invalid season start');
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo', year: 'numeric', month: 'numeric',
  }).formatToParts(now).filter(part => ['year', 'month'].includes(part.type))
    .sort((a, b) => a.type === 'year' ? -1 : b.type === 'year' ? 1 : 0)
    .map(part => Number(part.value));
  const season = month < start ? year - 1 : year;
  return { season, starts: `${season}-${String(start).padStart(2, '0')}-01`,
    endsBefore: `${season + 1}-${String(start).padStart(2, '0')}-01` };
}

async function authorized(request, env) {
  const actual = request.headers.get('authorization') ?? '';
  if (!env.MAC_ADMIN_KEY || env.MAC_ADMIN_KEY.length < 32 || actual.length > 256) return false;
  const encoder = new TextEncoder();
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [received, expected] = await Promise.all([digest(actual), digest('Bearer ' + env.MAC_ADMIN_KEY)]);
  return crypto.subtle.timingSafeEqual(received, expected);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (request.method === 'GET' && !action) {
    return new Response(page, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" } });
  }
  try {
    const period = seasonInfo(new Date(), env.MAC_SEASON_START_MONTH);
    const db = env.MAC_SEALS_DB;
    if (!db) return json({ error: 'La base de datos aún no está conectada.' }, 503);
    if (request.method === 'GET' && action === 'balance') {
      const code = url.searchParams.get('code');
      if (!validCode(code)) return json({ error: 'Código inválido.' }, 400);
      const card = await db.prepare(`
        SELECT COALESCE(SUM(1 + CASE WHEN e.kind = 'event' AND e.extras >= 3 THEN 1 ELSE 0 END), 0) AS stamps
        FROM mac_stamp_cards c
        LEFT JOIN mac_stamp_entries e ON e.card_id = c.id AND e.season = ?
        WHERE c.code = ? GROUP BY c.id
      `).bind(period.season, code).first();
      if (!card) return json({ error: 'Tarjeta no encontrada.' }, 404);
      return json({ ...period, stamps: card.stamps });
    }
    if (request.method !== 'POST' || !['create', 'record'].includes(action)) {
      return json({ error: 'Operación inválida.' }, 405);
    }
    if (!await authorized(request, env)) return json({ error: 'Clave de administración inválida.' }, 401);
    if (action === 'create') {
      const code = crypto.randomUUID().replaceAll('-', '');
      await db.prepare('INSERT INTO mac_stamp_cards (id, code) VALUES (?, ?)')
        .bind(crypto.randomUUID(), code).run();
      return json({ code, link: url.origin + root + '#tarjeta=' + code }, 201);
    }
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'Solicitud demasiado grande.' }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
    const { code, kind, extras } = data ?? {};
    const booking = typeof data?.booking === 'string' ? data.booking.trim().toUpperCase() : '';
    if (!validCode(code) || !['event', 'referral'].includes(kind) ||
      !/^[A-Z0-9_-]{1,64}$/.test(booking) || !Number.isSafeInteger(extras) ||
      extras < 0 || (kind === 'referral' && extras !== 0)) {
      return json({ error: 'Revisá la tarjeta, la referencia y los extras.' }, 400);
    }
    const card = await db.prepare('SELECT id FROM mac_stamp_cards WHERE code = ?').bind(code).first();
    if (!card) return json({ error: 'Tarjeta no encontrada.' }, 404);
    const inserted = await db.prepare(`
      INSERT INTO mac_stamp_entries (card_id, season, booking, kind, extras)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (booking, kind) DO NOTHING
    `).bind(card.id, period.season, booking, kind, extras).run();
    if (!inserted.meta.changes) return json({ error: 'Esa reserva ya fue registrada para ese tipo de sello.' }, 409);
    return json({ added: 1 + Number(kind === 'event' && extras >= 3), ...period }, 201);
  } catch {
    return json({ error: 'No se pudo completar la operación. Volvé a intentar.' }, 500);
  }
}

const page = `<!doctype html>
<html lang="es-UY"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sellos MAC Discoteque</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#110e19;color:#fff;font:17px system-ui}
main{max-width:670px;margin:auto;padding:30px 20px 60px}a{color:#dfb8ff}
h1{font-size:clamp(2.8rem,10vw,5rem);line-height:1;margin:24px 0 12px}
section,details{margin:20px 0;padding:22px;background:#211832;border:1px solid #4a3960;border-radius:16px}
h2{margin-top:0}li{margin:8px 0}label{display:block;margin:12px 0}
input,select,button{width:100%;padding:12px;border-radius:8px;font:inherit;margin-top:5px}
input,select{background:#120e1d;color:#fff;border:1px solid #80669a}
button{border:0;background:#dfb8ff;color:#211832;font-weight:700;cursor:pointer}
output{display:block;margin-top:12px;overflow-wrap:anywhere}summary{cursor:pointer}
</style>
<main><a href="/">Volver a MAC Discoteque</a><h1>Sellos MAC</h1><p>5% de descuento en cada servicio extra durante la promoción anual.</p>
<section><h2>Tu tarjeta</h2><form id="balance"><label>Código de tarjeta<input name="code" required maxlength="32" autocomplete="off"></label><button>Consultar sellos</button></form><output id="balanceResult" aria-live="polite"></output></section>
<section><h2>Cómo sumás</h2><ul><li>Cada fiesta propia contratada suma 1 sello.</li><li>Cada referido que contrata suma 1 sello.</li><li>Tres o más extras en una misma fiesta suman 1 sello adicional.</li></ul></section>
<section><h2>Calculá el descuento</h2><form id="discount"><label>Precio de un servicio extra (UYU)<input name="price" type="number" min="0" max="1000000" step="0.01" required></label><button>Calcular precio final</button></form><output id="discountResult" aria-live="polite"></output></section>
<details id="admin" hidden><summary>Administración MAC</summary><label>Clave de administración<input id="key" type="password" autocomplete="off"></label>
<button id="create" type="button">Crear tarjeta</button><output id="cardLink" aria-live="polite"></output>
<form id="record"><label>Código de tarjeta<input name="code" required maxlength="32"></label>
<label>Referencia de reserva<input name="booking" required maxlength="64" pattern="[A-Za-z0-9_\\-]+" title="Letras, números, guion o guion bajo"></label>
<label>Motivo<select name="kind"><option value="event">Fiesta propia</option><option value="referral">Referido</option></select></label>
<label>Extras contratados<input type="number" name="extras" min="0" step="1" value="0" required></label>
<button>Registrar sellos</button></form><output id="recordResult" aria-live="polite"></output></details>
</main><script>
const el = id => document.getElementById(id);
const balance = el('balance');
const discount = el('discount');
discount.onsubmit = event => {
  event.preventDefault();
  const cents = Math.round(Number(discount.elements.price.value) * 100);
  const saved = Math.round(cents / 20);
  const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' });
  el('discountResult').textContent = 'Descuento: ' + money.format(saved / 100) +
    ' · Precio final: ' + money.format((cents - saved) / 100);
};
const record = el('record');
const hash = new URLSearchParams(location.hash.slice(1));
el('admin').hidden = !hash.has('admin');
record.elements.kind.onchange = () => {
  const extras = record.elements.extras;
  extras.disabled = record.elements.kind.value === 'referral';
  if (extras.disabled) extras.value = '0';
};
async function call(action, data) {
  const params = new URLSearchParams({ action });
  const request = { cache: 'no-store' };
  if (action === 'balance') params.set('code', data.code);
  else Object.assign(request, { method: 'POST', headers: {
    authorization: 'Bearer ' + el('key').value, 'content-type': 'application/json',
  }, body: JSON.stringify(data) });
  const response = await fetch(location.pathname + '?' + params, request);
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'No se pudo completar la operación.');
  return result;
}
async function run(button, output, work) {
  button.disabled = true;
  output.textContent = 'Procesando…';
  try { await work(output); } catch (error) { output.textContent = error.message; }
  finally { button.disabled = false; }
}
balance.onsubmit = event => {
  event.preventDefault();
  run(balance.querySelector('button'), el('balanceResult'), async output => {
    const result = await call('balance', { code: balance.elements.code.value.trim().toLowerCase() });
    const format = date => date.split('-').reverse().join('/');
    output.textContent = result.stamps + (result.stamps === 1 ? ' sello' : ' sellos') +
      ' · Período del ' + format(result.starts) + ' hasta antes del ' + format(result.endsBefore) + '.';
  });
};
el('create').onclick = () => run(el('create'), el('cardLink'), async output => {
  const { code, link } = await call('create', {});
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.textContent = link;
  output.replaceChildren(anchor);
  record.elements.code.value = code;
});
record.onsubmit = event => {
  event.preventDefault();
  run(record.querySelector('button'), el('recordResult'), async output => {
    const { added } = await call('record', { code: record.elements.code.value.trim().toLowerCase(),
      booking: record.elements.booking.value, kind: record.elements.kind.value,
      extras: Number(record.elements.extras.value) });
    output.textContent = added + (added === 1 ? ' sello registrado.' : ' sellos registrados.');
  });
};
if (hash.has('tarjeta')) {
  balance.elements.code.value = hash.get('tarjeta');
  if (balance.reportValidity()) balance.requestSubmit();
}
</script></html>`;
