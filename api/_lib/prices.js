// Every number the owner may want to change (points prices, rewards, pack sizes) lives in the settings table and is edited from the owner dashboard.
// The defaults below are used until the owner sets a value. Values are cached for 20 seconds.
const DEFAULTS = {
  pack1_points: [12, 'Pack 1: points', 'Packs'], pack1_cents: [260, 'Pack 1: price in US cents (260 = $2.60)', 'Packs'],
  pack2_points: [29, 'Pack 2: points', 'Packs'], pack2_cents: [500, 'Pack 2: price in US cents (500 = $5.00)', 'Packs'],
  pack3_points: [100, 'Pack 3: points', 'Packs'], pack3_cents: [1000, 'Pack 3: price in US cents (1000 = $10.00)', 'Packs'],
  first_buy_bonus: [10, 'Free points on a person\'s first purchase', 'Packs'],
  selfie_reward: [20, 'Points for a checked selfie', 'Earn'],
  soc_earn_ig: [10, 'Points for adding Instagram', 'Earn'], soc_earn_snap: [10, 'Points for adding Snapchat', 'Earn'], soc_earn_tiktok: [10, 'Points for adding TikTok', 'Earn'], soc_earn_wa: [5, 'Points for adding a WhatsApp number (adults)', 'Earn'],
  invite_reward: [5, 'Points when an invited friend joins', 'Earn'],
  soc_price_ig: [10, 'See one Instagram account', 'Spend'], soc_price_snap: [10, 'See one Snapchat account', 'Spend'], soc_price_tiktok: [10, 'See one TikTok account', 'Spend'], soc_price_all: [20, 'See Instagram + Snapchat + TikTok together', 'Spend'], soc_price_wa: [100, 'See a WhatsApp number', 'Spend'],
  view_reveal: [1, 'See who viewed my profile (per person)', 'Spend'],
  photo_price: [25, 'Real photo for 30 days', 'Spend'],
  swipe_free_days: [7, 'Swipe: free days for every new person', 'Swipe'], swipe_price: [1, 'Swipe: stars per person of the other gender, after the free days', 'Swipe'],
  tod_price_1: [2, 'Truth or Dare level 1 (24 hours)', 'Truth or Dare'], tod_price_2: [4, 'Truth or Dare level 2', 'Truth or Dare'], tod_price_3: [5, 'Truth or Dare level 3', 'Truth or Dare'], tod_price_4: [10, 'Truth or Dare level 4', 'Truth or Dare'], tod_price_5: [15, 'Truth or Dare level 5', 'Truth or Dare']
};
let cache = null, at = 0;
/** All prices as { key: number }, defaults filled in. */
async function get(sql) {
  if (cache && Date.now() - at < 20000) return cache;
  const rows = await sql`select key, value from settings where key like any(array['pack%', 'first_buy%', 'selfie_%', 'soc_%', 'invite_%', 'view_%', 'photo_%', 'swipe_%', 'tod_price_%'])`;
  const out = {}; for (const [k, v] of Object.entries(DEFAULTS)) out[k] = v[0];
  for (const r of rows) { const n = Number(r.value); if (DEFAULTS[r.key] && Number.isFinite(n) && n >= 0 && n <= 1000000) out[r.key] = Math.round(n); }
  cache = out; at = Date.now(); return out;
}
const reset = () => { cache = null; };
module.exports = { get, reset, DEFAULTS };
