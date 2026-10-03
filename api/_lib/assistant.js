// The O HUB assistant: an automatic helper that answers the first questions in the support chat (how to buy points, free points, verification...).
// It always says it is automatic, never pretends to be a person, and passes anything it does not understand to the owner.
const prices = require('./prices');

const AR = /[؀-ۿ]/;
const has = (t, words) => words.some((w) => t.includes(w));

async function reply(sql, rawText, tid, threadId) {
  const text = String(rawText || '').toLowerCase(), ar = AR.test(rawText || '');
  // stay quiet when the owner is already talking in this chat, or just answered a moment ago
  const last = await sql`select from_user, body, created_at from dm_messages where thread_id = ${threadId} and from_user = ${tid} order by id desc limit 1`;
  if (last.length) { const age = Date.now() - new Date(last[0].created_at).getTime(); const auto = /^(Automatic assistant|مساعد آلي)/.test(last[0].body); if ((!auto && age < 5 * 60000) || (auto && age < 6000)) return null; }
  const P = await prices.get(sql), n = (await sql`select value from settings where key = 'whish_number'`)[0];
  const num = n && n.value ? '+' + n.value : '', packs = [[P.pack1_points, P.pack1_cents], [P.pack2_points, P.pack2_cents], [P.pack3_points, P.pack3_cents]].map(([p, c]) => (ar ? p + ' نقطة = $' : p + ' points = $') + (c / 100).toFixed(2)).join(' · ');
  const T = (en, arabic) => (ar ? 'مساعد آلي: ' + arabic : 'Automatic assistant: ' + en);
  const menuEn = ' You can ask me about: buying points, free points, verification, reporting someone, or deleting your account.', menuAr = ' بتقدر تسألني عن: شراء النقاط، النقاط المجانية، التوثيق، الإبلاغ عن شخص، أو حذف الحساب.';

  if (has(text, ['not received', "didn't get", 'did not get', 'no points', 'where are my points', 'pending']) || has(rawText, ['ما وصل', 'ما إجا', 'لسا ما', 'وين النقاط', 'ما انضافت'])) {
    return { text: T('If you already paid, open Shop and check “My orders”. The team checks every receipt by hand, usually within a few minutes, and you get a notification when the points arrive. I told the team to look at your order now.', 'إذا دفعت، افتح Shop وشوف "My orders". الفريق بيراجع كل إيصال يدوياً، عادةً خلال دقايق، وبيجيك إشعار لما توصل النقاط. خبّرت الفريق يطّلع على طلبك هلأ.'), urgent: true };
  }
  if (has(text, ["don't have whish", 'no whish', 'cannot pay', "can't pay", 'without whish']) || has(rawText, ['ما عندي ويش', 'ما عندي whish', 'ما بقدر ادفع', 'ما فيني ادفع', 'بدون ويش'])) {
    return { text: T('No problem. I passed this to the team. Tell us here how you would like to pay and someone will answer you.', 'ما في مشكلة. نقلت طلبك للفريق. احكينا هون كيف بتحب تدفع ومنرد عليك.'), urgent: true };
  }
  if (has(text, ['pay', 'buy', 'purchase', 'whish', 'checkout', 'order', 'topup', 'top up']) || has(rawText, ['دفع', 'ادفع', 'أدفع', 'شراء', 'اشتري', 'أشتري', 'ويش', 'اشتر'])) {
    return { text: T('To buy points: 1) open Shop and choose a pack (' + packs + '). 2) Send exactly that amount on Whish' + (num ? ' to ' + num : '') + '. 3) Take a screenshot of the Whish receipt, add it in Shop and type the Transaction ID. The team checks it and your points arrive in minutes. Your first purchase gives you ' + P.first_buy_bonus + ' free points. No receipt means no points.', 'لتشتري نقاط: 1) افتح Shop واختار باقة (' + packs + '). 2) ابعت المبلغ بالضبط عبر Whish' + (num ? ' على ' + num : '') + '. 3) صوّر الإيصال (screenshot) وضيفه بـShop واكتب رقم العملية Transaction ID. الفريق بيراجعه وبتوصلك النقاط خلال دقايق. أول شراء بيعطيك ' + P.first_buy_bonus + ' نقطة مجاناً. بدون إيصال ما في نقاط.') };
  }
  if (has(text, ['price', 'how much', 'cost', 'packs']) || has(rawText, ['كم', 'سعر', 'أسعار', 'اسعار', 'بكم'])) {
    return { text: T('The packs are: ' + packs + '.' + menuEn, 'الباقات: ' + packs + '.' + menuAr) };
  }
  if (has(text, ['free', 'earn', 'get points', 'more points']) || has(rawText, ['مجان', 'اكسب', 'أكسب', 'نقاط'])) {
    return { text: T('Free ways to get points: open the Home tab (Activities). You can verify with a selfie (' + P.selfie_reward + ' points), add Instagram, Snapchat and TikTok (' + P.soc_earn_ig + ' points each), open the daily surprise box, and invite friends (' + P.invite_reward + ' points when a friend joins).', 'طرق مجانية للنقاط: افتح تبويب Home (Activities). وثّق حسابك بسيلفي (' + P.selfie_reward + ' نقطة)، ضيف إنستغرام وسناب وتيك توك (' + P.soc_earn_ig + ' نقاط لكل واحد)، افتح الصندوق اليومي، وادعي أصحابك (' + P.invite_reward + ' نقاط لما صديق ينضم).') };
  }
  if (has(text, ['selfie', 'verify', 'verified', 'tick']) || has(rawText, ['سيلفي', 'توثيق', 'وثّق', 'وثق'])) {
    return { text: T('To get the verified tick: open Settings, then “Verified by selfie”, take a selfie showing the number of fingers the app asks for. The owner checks it once and then erases the picture. You get ' + P.selfie_reward + ' points.', 'للتوثيق: افتح Settings، ثم "Verified by selfie"، وخذ سيلفي وانت رافع عدد الأصابع اللي بيطلبه التطبيق. صاحب التطبيق بيراجعها مرة وحدة وبعدين بيمسحها. وبتاخد ' + P.selfie_reward + ' نقطة.') };
  }
  if (has(text, ['report', 'harass', 'abuse', 'bully', 'threat', 'block', 'scam']) || has(rawText, ['بلاغ', 'تحرش', 'تنمر', 'تهديد', 'حظر', 'احتيال', 'نصب'])) {
    return { text: T('I am sorry that happened. You can report any message with the flag button, or open the person’s profile and block them. I told the team to look at this. If you feel unsafe, tell a trusted adult.', 'آسفين على اللي صار. بتقدر تبلّغ عن أي رسالة بزر العلم، أو تفتح بروفايل الشخص وتحظره. خبّرت الفريق ليطّلع على الموضوع. إذا حسّيت إنك مش بأمان، خبّر شخص بالغ بتثق فيه.'), urgent: true };
  }
  if (has(text, ['delete my account', 'delete account', 'remove my account']) || has(rawText, ['احذف حسابي', 'حذف الحساب', 'حذف حسابي'])) {
    return { text: T('You can delete your account yourself: Settings, then “Delete my account”, type DELETE and your password. It erases your profile, messages and points.', 'بتقدر تحذف حسابك بنفسك: Settings، ثم "Delete my account"، واكتب DELETE وكلمة السر. بيمسح ملفك ورسائلك ونقاطك.') };
  }
  if (has(text, ['password', 'forgot', 'cannot log', "can't log"]) || has(rawText, ['كلمة السر', 'كلمة المرور', 'نسيت'])) {
    return { text: T('On the sign in screen tap “Forgot your password?”. You will need your email and the answers to your two security questions.', 'بشاشة الدخول اضغط "Forgot your password?". بتحتاج إيميلك وأجوبة سؤالين الأمان.') };
  }
  if (/^(hi|hey|hello|hii+|yo|salam|marhaba|مرحبا|هلا|هاي|أهلا|اهلا|سلام|السلام عليكم)[\s!.?]*$/i.test(String(rawText || '').trim())) {
    return { text: T('Hi! I am the automatic helper of the O HUB Team.' + menuEn + ' If you need a person, write your question and the team will answer here.', 'أهلا! أنا المساعد الآلي لفريق O HUB.' + menuAr + ' وإذا بدك شخص، اكتب سؤالك والفريق بيرد هون.') };
  }
  return { text: T('I passed your message to the team. They will answer here.' + menuEn, 'نقلت رسالتك للفريق. رح يردوا عليك هون.' + menuAr), urgent: false };
}
module.exports = { reply };
