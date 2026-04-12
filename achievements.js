// achievements.js

const CARD_IDS = [
  'fool','magician','high_priestess','empress','emperor','hierophant',
  'lovers','chariot','strength','hermit','wheel_of_fortune','justice',
  'hanged_man','death','temperance','devil','tower','star','moon',
  'sun','judgement','world',
];

export const ACHIEVEMENT_GROUPS = [
  {
    id: 'streak', name: '継続', nameEn: 'Streak',
    items: [
      { id:'streak_1',      name:'はじめの一歩',   nameEn:'First Step',          condition:'初めておみくじを引く',             conditionEn:'Draw your first fortune',              check:(s)=>s.totalCount>=1 },
      { id:'streak_3',      name:'3日坊主卒業',    nameEn:'Beyond 3 Days',       condition:'3日連続でおみくじを引く',           conditionEn:'3-day streak',                         check:(s)=>s.maxStreak>=3 },
      { id:'streak_7',      name:'一週間の旅人',   nameEn:'Week Traveler',       condition:'7日連続でおみくじを引く',           conditionEn:'7-day streak',                         check:(s)=>s.maxStreak>=7 },
      { id:'streak_30',     name:'月の巡り',       nameEn:'Moon Cycle',          condition:'30日連続でおみくじを引く',          conditionEn:'30-day streak',                        check:(s)=>s.maxStreak>=30 },
      { id:'streak_100',    name:'百日の誓い',     nameEn:'Hundred Days',        condition:'100日連続でおみくじを引く',         conditionEn:'100-day streak',                       check:(s)=>s.maxStreak>=100 },
      { id:'streak_365',    name:'永遠の旅人',     nameEn:'Eternal Traveler',    condition:'365日連続でおみくじを引く',         conditionEn:'365-day streak',                       check:(s)=>s.maxStreak>=365 },
      { id:'streak_return', name:'出戻り旅人',     nameEn:'Returning Traveler',  condition:'途切れた後に再びおみくじを引く',    conditionEn:'Return after a streak break',          check:(s)=>s.hadReturn },
    ],
  },
  {
    id: 'collection', name: 'コレクション', nameEn: 'Collection',
    items: [
      { id:'col_first',    name:'初収録',          nameEn:'First Arcana',         condition:'初めてアルカナを収録する',              conditionEn:'Add your first Arcana',              check:(_,col)=>col.size>=1 },
      { id:'col_half',     name:'半分の真実',      nameEn:'Half Truth',           condition:'アルカナを22種収録する',                conditionEn:'Collect 22 Arcana cards',            check:(_,col)=>col.size>=22 },
      { id:'col_upright',  name:'正位置コンプ',    nameEn:'Upright Complete',     condition:'正位置22種をすべて収録する',             conditionEn:'Collect all 22 upright cards',       check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_upright`)) },
      { id:'col_reversed', name:'逆位置コンプ',    nameEn:'Reversed Complete',    condition:'逆位置22種をすべて収録する',             conditionEn:'Collect all 22 reversed cards',      check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_reversed`)) },
      { id:'col_all',      name:'アルカナ全開放',  nameEn:'Arcana Master',        condition:'アルカナ44種すべてを収録する',           conditionEn:'Collect all 44 Arcana cards',        check:(_,col)=>col.size>=44 },
      { id:'col_fool',     name:'愚者の旅立ち',    nameEn:"The Fool's Journey",   condition:'「愚者」を収録する',                    conditionEn:'Add "The Fool" to collection',       check:(_,col)=>col.has('fool_upright')||col.has('fool_reversed') },
      { id:'col_world',    name:'世界の完成',      nameEn:'World Completed',      condition:'「世界」を収録する',                    conditionEn:'Add "The World" to collection',      check:(_,col)=>col.has('world_upright')||col.has('world_reversed') },
      { id:'col_lovers',   name:'運命の出会い',    nameEn:'Fated Meeting',        condition:'「恋人」を収録する',                    conditionEn:'Add "The Lovers" to collection',     check:(_,col)=>col.has('lovers_upright')||col.has('lovers_reversed') },
      { id:'col_death',    name:'死の受容',        nameEn:'Acceptance of Death',  condition:'「死神」を収録する',                    conditionEn:'Add "Death" to collection',          check:(_,col)=>col.has('death_upright')||col.has('death_reversed') },
    ],
  },
  {
    id: 'fortune', name: '運勢', nameEn: 'Fortune',
    items: [
      { id:'fortune_daikichi',   name:'大吉引き',       nameEn:'Great Fortune',           condition:'大吉を引く',                             conditionEn:'Draw a Great Fortune',                    check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=1 },
      { id:'fortune_daikichi_5', name:'大吉コレクター', nameEn:'Great Fortune Collector', condition:'大吉を5回引く',                          conditionEn:'Draw Great Fortune 5 times',              check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=5 },
      { id:'fortune_kyo',        name:'凶でも笑って',   nameEn:'Smile Through Misfortune',condition:'凶を引く',                               conditionEn:'Draw a Misfortune',                       check:(s)=>(s.fortuneLevelCounts['凶']||0)>=1 },
      { id:'fortune_kyo_3',      name:'凶の探求者',     nameEn:'Seeker of Misfortune',    condition:'凶を3回引く',                            conditionEn:'Draw Misfortune 3 times',                 check:(s)=>(s.fortuneLevelCounts['凶']||0)>=3 },
      { id:'fortune_both',       name:'波乱万丈',       nameEn:'Full of Ups and Downs',   condition:'大吉と凶を両方引いたことがある',          conditionEn:'Draw both Great Fortune and Misfortune', check:(s)=>(s.fortuneLevelCounts['大吉']||0)>=1&&(s.fortuneLevelCounts['凶']||0)>=1 },
      { id:'fortune_all',        name:'運勢の振れ幅',   nameEn:'Full Spectrum',           condition:'大吉・吉・中吉・小吉・末吉・凶をすべて引く', conditionEn:'Experience all 6 fortune levels',    check:(s)=>['大吉','吉','中吉','小吉','末吉','凶'].every(l=>(s.fortuneLevelCounts[l]||0)>=1) },
    ],
  },
  {
    id: 'zodiac', name: '星座', nameEn: 'Zodiac',
    items: [
      { id:'zodiac_first', name:'星読みの入門', nameEn:'First Star Reading', condition:'初めて星座占いを見る',       conditionEn:'See your first zodiac reading',          check:(s)=>s.zodiacsSeen.length>=1 },
      { id:'zodiac_all',   name:'十二宮の旅',   nameEn:'Zodiac Journey',     condition:'12星座すべての占いを見る',   conditionEn:'See fortune for all 12 zodiac signs',   check:(s)=>s.zodiacsSeen.length>=12 },
    ],
  },
  {
    id: 'biorhythm', name: 'バイオリズム', nameEn: 'Biorhythm',
    items: [
      { id:'bio_peak',     name:'絶好調の日',       nameEn:'Peak Day',     condition:'身体・感情・知性がすべて0.5以上の日に引く',  conditionEn:'Draw when all 3 biorhythms ≥ 0.5',          check:(s)=>s.hadBioPeak },
      { id:'bio_low',      name:'どん底',           nameEn:'Rock Bottom',  condition:'身体・感情・知性がすべて-0.5以下の日に引く', conditionEn:'Draw when all 3 biorhythms ≤ −0.5',         check:(s)=>s.hadBioLow },
      { id:'bio_critical', name:'クリティカルデー', nameEn:'Critical Day', condition:'いずれかのバイオリズムが±0.1以内の日に引く',  conditionEn:'Draw when any biorhythm is within ±0.1 of zero', check:(s)=>s.hadBioCritical },
    ],
  },
  {
    id: 'reversed', name: '逆位置', nameEn: 'Reversed',
    items: [
      { id:'rev_first', name:'逆さの真実', nameEn:'Reversed Truth',         condition:'初めて逆位置カードを収録する', conditionEn:'Collect your first reversed card', check:(_,col)=>[...col].some(k=>k.endsWith('_reversed')) },
      { id:'rev_10',    name:'逆境の使者', nameEn:'Messenger of Adversity', condition:'逆位置カードを10枚収録する',  conditionEn:'Collect 10 reversed cards',        check:(_,col)=>[...col].filter(k=>k.endsWith('_reversed')).length>=10 },
      { id:'rev_all',   name:'闇の探求者', nameEn:'Seeker of Shadows',      condition:'逆位置22種をすべて収録する',  conditionEn:'Collect all 22 reversed cards',    check:(_,col)=>CARD_IDS.every(id=>col.has(`${id}_reversed`)) },
    ],
  },
  {
    id: 'fun', name: 'ネタ', nameEn: 'Fun',
    items: [
      { id:'fun_noname',   name:'名無しの旅人',      nameEn:'Nameless Traveler',    condition:'名前を入力せずに占う',    conditionEn:'Draw fortune without a name',            check:(s)=>s.hadNoName },
      { id:'fun_name',     name:'名乗る者',          nameEn:'One Who Names Themselves', condition:'名前を入力して占う', conditionEn:'Draw fortune with a name entered',       check:(s)=>s.hadName },
      { id:'fun_debug',    name:'uko公認デバッガー',  nameEn:"uko's Debugger",       condition:'???',                   conditionEn:'???',                                    check:(s)=>s.hadDebug },
      { id:'fun_midnight', name:'深夜の旅人',        nameEn:'Midnight Traveler',    condition:'深夜0〜2時の間に占う',   conditionEn:'Draw fortune between 0:00 and 2:00 AM', check:(s)=>s.hadMidnight },
      { id:'fun_early',    name:'早起きの旅人',      nameEn:'Early Bird',           condition:'朝5〜7時の間に占う',    conditionEn:'Draw fortune between 5:00 and 7:00 AM', check:(s)=>s.hadEarlyMorning },
      { id:'fun_omisoka',  name:'大晦日の占い',      nameEn:"New Year's Eve Fortune",condition:'12月31日に占う',       conditionEn:'Draw fortune on December 31st',          check:(s)=>s.hadOmisoka },
      { id:'fun_newyear',  name:'元日の誓い',        nameEn:"New Year's Vow",       condition:'1月1日に占う',          conditionEn:'Draw fortune on January 1st',            check:(s)=>s.hadNewYear },
      { id:'fun_birthday', name:'誕生日占い',        nameEn:'Birthday Fortune',     condition:'自分の誕生日に占う',    conditionEn:'Draw fortune on your own birthday',      check:(s)=>s.hadBirthday },
    ],
  },
  {
    id: 'total', name: '累計', nameEn: 'Total',
    items: [
      { id:'total_10',  name:'旅の記録',         nameEn:'Travel Log',         condition:'累計10回おみくじを引く',  conditionEn:'Draw fortune 10 times total',   check:(s)=>s.totalCount>=10 },
      { id:'total_50',  name:'星詠みの習慣',     nameEn:'Star-Reading Habit', condition:'累計50回おみくじを引く',  conditionEn:'Draw fortune 50 times total',   check:(s)=>s.totalCount>=50 },
      { id:'total_100', name:'運命の探求者',     nameEn:'Seeker of Fate',     condition:'累計100回おみくじを引く', conditionEn:'Draw fortune 100 times total',  check:(s)=>s.totalCount>=100 },
      { id:'total_365', name:'テイワットの賢者', nameEn:'Sage of Teyvat',     condition:'累計365回おみくじを引く', conditionEn:'Draw fortune 365 times total',  check:(s)=>s.totalCount>=365 },
    ],
  },
];

export const ALL_ACHIEVEMENTS = ACHIEVEMENT_GROUPS.flatMap(g =>
  g.items.map(a => ({ ...a, groupId: g.id }))
);
