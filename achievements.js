// achievements.js

const CARD_IDS = [
  'fool','magician','high_priestess','empress','emperor','hierophant',
  'lovers','chariot','strength','hermit','wheel_of_fortune','justice',
  'hanged_man','death','temperance','devil','tower','star','moon',
  'sun','judgement','world',
];

// アルカナ両面収録アチーブメント生成用データ
const ARCANA_DATA = [
  { id:'fool',             ja:'愚者',     en:'The Fool' },
  { id:'magician',         ja:'魔術師',   en:'The Magician' },
  { id:'high_priestess',   ja:'女教皇',   en:'The High Priestess' },
  { id:'empress',          ja:'女帝',     en:'The Empress' },
  { id:'emperor',          ja:'皇帝',     en:'The Emperor' },
  { id:'hierophant',       ja:'聖職者',   en:'The Hierophant' },
  { id:'lovers',           ja:'恋人',     en:'The Lovers' },
  { id:'chariot',          ja:'戦車',     en:'The Chariot' },
  { id:'strength',         ja:'力',       en:'Strength' },
  { id:'hermit',           ja:'隠者',     en:'The Hermit' },
  { id:'wheel_of_fortune', ja:'運命の輪', en:'Wheel of Fortune' },
  { id:'justice',          ja:'正義',     en:'Justice' },
  { id:'hanged_man',       ja:'吊られた男', en:'The Hanged Man' },
  { id:'death',            ja:'死神',     en:'Death' },
  { id:'temperance',       ja:'節制',     en:'Temperance' },
  { id:'devil',            ja:'悪魔',     en:'The Devil' },
  { id:'tower',            ja:'塔',       en:'The Tower' },
  { id:'star',             ja:'星',       en:'The Star' },
  { id:'moon',             ja:'月',       en:'The Moon' },
  { id:'sun',              ja:'太陽',     en:'The Sun' },
  { id:'judgement',        ja:'審判',     en:'Judgement' },
  { id:'world',            ja:'世界',     en:'The World' },
];

export const ACHIEVEMENT_GROUPS = [
  {
    id: 'streak', name: '継続', nameEn: 'Streak',
    items: [
      { id:'streak_1',      rarity:'bronze', name:'はじめの一歩',   nameEn:'First Step',          condition:'初めておみくじを引く',             conditionEn:'Draw your first fortune',              check:(s)=>s.totalCount>=1 },
      { id:'streak_3',      rarity:'bronze', name:'3日坊主卒業',    nameEn:'Beyond 3 Days',       condition:'3日連続でおみくじを引く',           conditionEn:'3-day streak',                         check:(s)=>s.maxStreak>=3 },
      { id:'streak_7',      rarity:'silver', name:'一週間の旅人',   nameEn:'Week Traveler',       condition:'7日連続でおみくじを引く',           conditionEn:'7-day streak',                         check:(s)=>s.maxStreak>=7 },
      { id:'streak_30',     rarity:'gold',   name:'月の巡り',       nameEn:'Moon Cycle',          condition:'30日連続でおみくじを引く',          conditionEn:'30-day streak',                        check:(s)=>s.maxStreak>=30 },
      { id:'streak_100',    rarity:'gold',   name:'百日の誓い',     nameEn:'Hundred Days',        condition:'100日連続でおみくじを引く',         conditionEn:'100-day streak',                       check:(s)=>s.maxStreak>=100 },
      { id:'streak_365',    rarity:'legend', name:'永遠の旅人',     nameEn:'Eternal Traveler',    condition:'365日連続でおみくじを引く',         conditionEn:'365-day streak',                       check:(s)=>s.maxStreak>=365 },
      { id:'streak_return', rarity:'silver', name:'出戻り旅人',     nameEn:'Returning Traveler',  condition:'途切れた後に再びおみくじを引く',    conditionEn:'Return after a streak break',          check:(s)=>s.hadReturn },
    ],
  },
  {
    id: 'collection', name: 'コレクション', nameEn: 'Collection',
    items: [
      { id:'col_first',    rarity:'bronze', name:'初収録',          nameEn:'First Arcana',         condition:'初めてアルカナを収録する',              conditionEn:'Add your first Arcana',              check:(_,col)=>col.size>=1 },
      { id:'col_half',     rarity:'silver', name:'半分の真実',      nameEn:'Half Truth',           condition:'アルカナを22種収録する',                conditionEn:'Collect 22 Arcana cards',            check:(_,col)=>col.size>=22 },
      { id:'col_upright',  rarity:'gold',   name:'正位置コンプ',    nameEn:'Upright Complete',     condition:'正位置22種をすべて収録する',             conditionEn:'Collect all 22 upright cards',       check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_upright`)) },
      { id:'col_reversed', rarity:'gold',   name:'逆位置コンプ',    nameEn:'Reversed Complete',    condition:'逆位置22種をすべて収録する',             conditionEn:'Collect all 22 reversed cards',      check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_reversed`)) },
      { id:'col_all',      rarity:'legend', name:'アルカナ全開放',  nameEn:'Arcana Master',        condition:'アルカナ44種すべてを収録する',           conditionEn:'Collect all 44 Arcana cards',        check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_upright`)&&col.has(`${id}_reversed`)) },
    ],
  },
  {
    id: 'arcana', name: 'アルカナ両面', nameEn: 'Arcana Duality',
    items: ARCANA_DATA.map(c => ({
      id:          `col_pair_${c.id}`,
      rarity:      'bronze',
      name:        `${c.ja}の両面`,
      nameEn:      `${c.en} · Duality`,
      condition:   `「${c.ja}」を正・逆両方収録する`,
      conditionEn: `Collect both upright and reversed of ${c.en}`,
      check:       (_, col) => col.has(`${c.id}_upright`) && col.has(`${c.id}_reversed`),
    })),
  },
  {
    id: 'fortune', name: '運勢', nameEn: 'Fortune',
    items: [
      { id:'fortune_daikichi',   rarity:'bronze', name:'大吉引き',       nameEn:'Great Fortune',           condition:'大吉を引く',                             conditionEn:'Draw a Great Fortune',                    check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=1 },
      { id:'fortune_daikichi_5', rarity:'silver', name:'大吉コレクター', nameEn:'Great Fortune Collector', condition:'大吉を5回引く',                          conditionEn:'Draw Great Fortune 5 times',              check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=5 },
      { id:'fortune_kyo',        rarity:'bronze', name:'凶でも笑って',   nameEn:'Smile Through Misfortune',condition:'凶を引く',                               conditionEn:'Draw a Misfortune',                       check:(s)=>(s.fortuneLevelCounts['凶']||0)>=1 },
      { id:'fortune_kyo_3',      rarity:'silver', name:'凶の探求者',     nameEn:'Seeker of Misfortune',    condition:'凶を3回引く',                            conditionEn:'Draw Misfortune 3 times',                 check:(s)=>(s.fortuneLevelCounts['凶']||0)>=3 },
      { id:'fortune_both',       rarity:'silver', name:'波乱万丈',       nameEn:'Full of Ups and Downs',   condition:'大吉と凶を両方引いたことがある',          conditionEn:'Draw both Great Fortune and Misfortune', check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=1&&(s.fortuneLevelCounts['凶']||0)>=1 },
      { id:'fortune_all',        rarity:'gold',   name:'運勢の振れ幅',   nameEn:'Full Spectrum',           condition:'大吉・吉・中吉・小吉・末吉・凶をすべて引く', conditionEn:'Experience all 6 fortune levels',    check:(s)=>['大吉','吉','中吉','小吉','末吉','凶'].every(l=>(s.fortuneLevelCounts[l]||0)>=1) },
    ],
  },
  {
    id: 'zodiac', name: '星座', nameEn: 'Zodiac',
    items: [
      { id:'zodiac_first', rarity:'bronze', name:'星読みの入門', nameEn:'First Star Reading', condition:'初めて星座占いを見る',       conditionEn:'See your first zodiac reading',          check:(s)=>s.zodiacsSeen.length>=1 },
      { id:'zodiac_all',   rarity:'gold',   name:'十二宮の旅',   nameEn:'Zodiac Journey',     condition:'12星座すべての占いを見る',   conditionEn:'See fortune for all 12 zodiac signs',   check:(s)=>s.zodiacsSeen.length>=12 },
    ],
  },
  {
    id: 'biorhythm', name: 'バイオリズム', nameEn: 'Biorhythm',
    items: [
      { id:'bio_peak',     rarity:'silver', name:'絶好調の日',       nameEn:'Peak Day',     condition:'身体・感情・知性がすべて0.5以上の日に引く',  conditionEn:'Draw when all 3 biorhythms ≥ 0.5',          check:(s)=>s.hadBioPeak },
      { id:'bio_low',      rarity:'silver', name:'どん底',           nameEn:'Rock Bottom',  condition:'身体・感情・知性がすべて-0.5以下の日に引く', conditionEn:'Draw when all 3 biorhythms ≤ −0.5',         check:(s)=>s.hadBioLow },
      { id:'bio_critical', rarity:'silver', name:'クリティカルデー', nameEn:'Critical Day', condition:'いずれかのバイオリズムが±0.1以内の日に引く',  conditionEn:'Draw when any biorhythm is within ±0.1 of zero', check:(s)=>s.hadBioCritical },
    ],
  },
  {
    id: 'reversed', name: '逆位置', nameEn: 'Reversed',
    items: [
      { id:'rev_first', rarity:'bronze', name:'逆さの真実', nameEn:'Reversed Truth',         condition:'初めて逆位置カードを収録する', conditionEn:'Collect your first reversed card', check:(_,col)=>[...col].some(k=>k.endsWith('_reversed')) },
      { id:'rev_10',    rarity:'silver', name:'逆境の使者', nameEn:'Messenger of Adversity', condition:'逆位置カードを10枚収録する',  conditionEn:'Collect 10 reversed cards',        check:(_,col)=>[...col].filter(k=>k.endsWith('_reversed')).length>=10 },
      { id:'rev_all',   rarity:'gold',   name:'闇の探求者', nameEn:'Seeker of Shadows',      condition:'逆位置22種をすべて収録する',  conditionEn:'Collect all 22 reversed cards',    check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_reversed`)) },
    ],
  },
  {
    id: 'fun', name: 'ネタ', nameEn: 'Fun',
    items: [
      { id:'fun_noname',   rarity:'bronze', name:'名無しの旅人',      nameEn:'Nameless Traveler',    condition:'名前を入力せずに占う',    conditionEn:'Draw fortune without a name',            check:(s)=>s.hadNoName },
      { id:'fun_name',     rarity:'bronze', name:'名乗る者',          nameEn:'One Who Names Themselves', condition:'名前を入力して占う', conditionEn:'Draw fortune with a name entered',       check:(s)=>s.hadName },
      { id:'fun_debug',    rarity:'gold',   name:'uko公認デバッガー',  nameEn:"uko's Debugger",       condition:'???',                   conditionEn:'???',                                    check:(s)=>s.hadDebug },
      { id:'fun_midnight', rarity:'silver', name:'深夜の旅人',        nameEn:'Midnight Traveler',    condition:'深夜0〜2時の間に占う',   conditionEn:'Draw fortune between 0:00 and 2:00 AM', check:(s)=>s.hadMidnight },
      { id:'fun_early',    rarity:'silver', name:'早起きの旅人',      nameEn:'Early Bird',           condition:'朝5〜7時の間に占う',    conditionEn:'Draw fortune between 5:00 and 7:00 AM', check:(s)=>s.hadEarlyMorning },
      { id:'fun_omisoka',  rarity:'silver', name:'大晦日の占い',      nameEn:"New Year's Eve Fortune",condition:'12月31日に占う',       conditionEn:'Draw fortune on December 31st',          check:(s)=>s.hadOmisoka },
      { id:'fun_newyear',  rarity:'silver', name:'元日の誓い',        nameEn:"New Year's Vow",       condition:'1月1日に占う',          conditionEn:'Draw fortune on January 1st',            check:(s)=>s.hadNewYear },
      { id:'fun_birthday', rarity:'gold',   name:'誕生日占い',        nameEn:'Birthday Fortune',     condition:'自分の誕生日に占う',    conditionEn:'Draw fortune on your own birthday',      check:(s)=>s.hadBirthday },
    ],
  },
  {
    id: 'total', name: '累計', nameEn: 'Total',
    items: [
      { id:'total_10',  rarity:'bronze', name:'旅の記録',         nameEn:'Travel Log',         condition:'累計10回おみくじを引く',  conditionEn:'Draw fortune 10 times total',   check:(s)=>s.totalCount>=10 },
      { id:'total_50',  rarity:'silver', name:'星詠みの習慣',     nameEn:'Star-Reading Habit', condition:'累計50回おみくじを引く',  conditionEn:'Draw fortune 50 times total',   check:(s)=>s.totalCount>=50 },
      { id:'total_100', rarity:'gold',   name:'運命の探求者',     nameEn:'Seeker of Fate',     condition:'累計100回おみくじを引く', conditionEn:'Draw fortune 100 times total',  check:(s)=>s.totalCount>=100 },
      { id:'total_365', rarity:'legend', name:'テイワットの賢者', nameEn:'Sage of Teyvat',     condition:'累計365回おみくじを引く', conditionEn:'Draw fortune 365 times total',  check:(s)=>s.totalCount>=365 },
    ],
  },
  {
    id: 'rare', name: '秘蔵アルカナ', nameEn: 'Secret Arcana',
    items: [
      {
        id: 'rare_good',
        rarity: 'legend',
        name:        '七星の奇跡',
        nameEn:      'Miracle of Seven Stars',
        condition:   'アルカナ展開時、超低確率で現れる光のアルカナを引き当てる',
        conditionEn: 'Draw the radiant Arcana that appears with an extremely low chance during fortune reading',
        check: (_, col) => col.has('rare_good'),
      },
      {
        id: 'rare_bad',
        rarity: 'legend',
        name:           '奈落の引き寄せ',
        nameEn:         'Called by the Abyss',
        condition:      'シャッフル時に1%で潜む闇のアルカナを引き当てる',
        conditionEn:    'Draw the dark Arcana lurking at 1% chance during shuffle',
        conditionLocked:    '特定のアチーブメントを取得すると解放される',
        conditionLockedEn:  'Obtain a specific achievement to reveal this condition',
        prerequisite:   'rare_good',
        check: (_, col) => col.has('rare_bad'),
      },
    ],
  },
];

export const ALL_ACHIEVEMENTS = ACHIEVEMENT_GROUPS.flatMap(g =>
  g.items.map(a => ({ ...a, groupId: g.id }))
);
