// tarot.js
// 原神アルカナ22枚（大アルカナ全て）

const omikujiFolder = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? '/99_SharedImage/01_Genshin/Omikuji/'
  : 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/Omikuji/';

export const CARD_BACK = `${omikujiFolder}back.png`;

export const tarotCards = [
  {
    id: 'fool',
    name: '愚者',
    number: '0',
    filename: `${omikujiFolder}Fool.png`,
    upright: {
      keyword: '自由・無限の可能性・新出発',
      message: '今日は何も恐れず一歩踏み出すエネルギーに満ちた日。常識を超えた先に本当の自分がいる。',
      lucky: '新品のスニーカー',
    },
    reversed: {
      keyword: '無謀・準備不足・無責任',
      message: '勢いだけで動くのは危険な日。少し立ち止まって、リスクを確認してから進もう。',
      lucky: 'チェックリスト',
    },
  },
  {
    id: 'magician',
    name: '魔術師',
    number: 'I',
    filename: `${omikujiFolder}Magician.png`,
    upright: {
      keyword: '新たな始まり・意志・才能',
      message: '今日はあなたの中に眠る才能が輝きを放つ日。新しい挑戦に踏み出す意志が、道を切り拓く。',
      lucky: '筆記用具',
    },
    reversed: {
      keyword: '才能の停滞・焦り・空回り',
      message: '力はあるのに空回りしている状態。今日は焦らず、まず足元を見つめ直そう。',
      lucky: '深呼吸の時間',
    },
  },
  {
    id: 'high_priestess',
    name: '女教皇',
    number: 'II',
    filename: `${omikujiFolder}High_Priestess.png`,
    upright: {
      keyword: '直感・内なる知恵・静観',
      message: '今日は直感が研ぎ澄まされている。論理より感覚を信じて動くと、思わぬ真実にたどり着く。',
      lucky: '日記',
    },
    reversed: {
      keyword: '情報不足・迷い・隠し事',
      message: 'まだ見えていない情報がある。今日は決断を急がず、もう少し状況を見守ろう。',
      lucky: '静かな場所',
    },
  },
  {
    id: 'empress',
    name: '女帝',
    number: 'III',
    filename: `${omikujiFolder}Empress.png`,
    upright: {
      keyword: '豊かさ・創造性・繁栄',
      message: '今日は豊かさのエネルギーに満ちた日。感性を活かした行動が実を結ぶ。',
      lucky: '花',
    },
    reversed: {
      keyword: '依存・停滞・過保護',
      message: '誰かに頼りすぎていないか振り返ろう。自分の力で一歩踏み出すことが大切な日。',
      lucky: '新鮮な食べ物',
    },
  },
  {
    id: 'emperor',
    name: '皇帝',
    number: 'IV',
    filename: `${omikujiFolder}Emperor.png`,
    upright: {
      keyword: '安定・権威・秩序',
      message: '今日は安定と秩序の日。計画通りに動けば、着実に成果が積み上がる。',
      lucky: '手帳',
    },
    reversed: {
      keyword: '頑固・支配・硬直',
      message: '自分のやり方に固執しすぎているかもしれない。柔軟さが今日のカギ。',
      lucky: '散歩',
    },
  },
  {
    id: 'hierophant',
    name: '聖職者',
    number: 'V',
    filename: `${omikujiFolder}Hierophant.png`,
    upright: {
      keyword: '信念・導き・学び',
      message: '今日は誰かの言葉や教えが心に響く日。素直に受け取ることで新しい視野が開ける。',
      lucky: '本',
    },
    reversed: {
      keyword: '因習・独断・形式主義',
      message: '古いルールや他人の意見に縛られすぎていないか。今日は自分の軸で判断しよう。',
      lucky: '音楽',
    },
  },
  {
    id: 'lovers',
    name: '恋人',
    number: 'VI',
    filename: `${omikujiFolder}Lovers.png`,
    upright: {
      keyword: '愛・調和・大切な選択',
      message: '心と心が通じ合う予感のある日。大切な人との時間を丁寧に過ごそう。',
      lucky: 'ペアのもの',
    },
    reversed: {
      keyword: '不調和・迷い・誘惑',
      message: '感情が揺れやすい日。大きな決断は今日でなくてもいい。',
      lucky: '一人の時間',
    },
  },
  {
    id: 'chariot',
    name: '戦車',
    number: 'VII',
    filename: `${omikujiFolder}Chariot.png`,
    upright: {
      keyword: '勝利・前進・意志力',
      message: '今日は勢いに乗れる日。目標に向かって迷いなく突き進もう。勝機は行動の中にある。',
      lucky: 'スポーツシューズ',
    },
    reversed: {
      keyword: '暴走・方向喪失・焦り',
      message: 'スピードを出しすぎているかもしれない。立ち止まって方向を確認しよう。',
      lucky: '地図',
    },
  },
  {
    id: 'strength',
    name: '力',
    number: 'VIII',
    filename: `${omikujiFolder}Strength.png`,
    upright: {
      keyword: '勇気・忍耐・内なる強さ',
      message: '今日の強さは、穏やかさの中にある。感情をコントロールしながら前を向こう。',
      lucky: 'お守り',
    },
    reversed: {
      keyword: '自己不信・弱気・感情的',
      message: '自分を過小評価していないか。あなたにはもっと力がある。今日は自分を信じて。',
      lucky: '鏡',
    },
  },
  {
    id: 'hermit',
    name: '隠者',
    number: 'IX',
    filename: `${omikujiFolder}Hermit.png`,
    upright: {
      keyword: '内省・孤独・知恵',
      message: '今日は内側に向かう日。静かな時間を確保して、自分の本音と向き合おう。',
      lucky: 'キャンドル',
    },
    reversed: {
      keyword: '孤立・引きこもり・頑固',
      message: '殻に閉じこもりすぎていないか。少し外に目を向けると光が見えてくる。',
      lucky: '友人へのメッセージ',
    },
  },
  {
    id: 'wheel_of_fortune',
    name: '運命の輪',
    number: 'X',
    filename: `${omikujiFolder}Wheel_of_Fortune.png`,
    upright: {
      keyword: '転機・幸運・変化',
      message: '今日は流れが変わる予感がある日。チャンスは突然やってくる。アンテナを張っておこう。',
      lucky: 'コイン',
    },
    reversed: {
      keyword: '停滞・不運・変化への抵抗',
      message: '流れに逆らわず、今は待ちの姿勢が吉。焦らず次の波を待とう。',
      lucky: 'お茶',
    },
  },
  {
    id: 'justice',
    name: '正義',
    number: 'XI',
    filename: `${omikujiFolder}Justice.png`,
    upright: {
      keyword: '公正・真実・バランス',
      message: '今日は誠実さが報われる日。正しいと思う行動を迷わず取ろう。',
      lucky: '白いもの',
    },
    reversed: {
      keyword: '不公平・偏見・責任逃れ',
      message: '自分に都合の良い解釈をしていないか振り返ろう。公平な目で状況を見つめ直して。',
      lucky: '天秤',
    },
  },
  {
    id: 'hanged_man',
    name: '吊るされた男',
    number: 'XII',
    filename: `${omikujiFolder}Hanged_Man.png`,
    upright: {
      keyword: '待機・新しい視点・悟り',
      message: '今日は視点を変えると答えが見えてくる日。じっくり待つことも大切な選択。',
      lucky: '逆さに読める本',
    },
    reversed: {
      keyword: '停滞・無駄な犠牲・煮え切らない',
      message: 'いつまでも宙ぶらりんな状態を続けていないか。小さな決断から始めてみよう。',
      lucky: '新しいルート',
    },
  },
  {
    id: 'death',
    name: '死神',
    number: 'XIII',
    filename: `${omikujiFolder}Death.png`,
    upright: {
      keyword: '終わりと始まり・変容・手放す',
      message: '今日は何かを手放すことで新しい扉が開く日。終わりを恐れず、変化を受け入れよう。',
      lucky: '古いものの整理',
    },
    reversed: {
      keyword: '変化への抵抗・執着・停滞',
      message: '手放せないものに縛られていないか。変化を拒むことで逆に苦しくなっている。',
      lucky: '断捨離',
    },
  },
  {
    id: 'temperance',
    name: '節制',
    number: 'XIV',
    filename: `${omikujiFolder}Temperance.png`,
    upright: {
      keyword: 'バランス・調和・忍耐',
      message: '今日は焦らず、ゆっくりと調和を保ちながら進む日。急ぎすぎないことが最大の近道。',
      lucky: 'ハーブティー',
    },
    reversed: {
      keyword: '過剰・不調和・焦り',
      message: 'やりすぎていることがないか見直そう。今日は引き算の発想が大切。',
      lucky: '休憩時間',
    },
  },
  {
    id: 'devil',
    name: '悪魔',
    number: 'XV',
    filename: `${omikujiFolder}Devil.png`,
    upright: {
      keyword: '執着・誘惑・束縛',
      message: '今日は何かに縛られていないか確認の日。手放す勇気が自由をもたらす。',
      lucky: '換気',
    },
    reversed: {
      keyword: '解放・気づき・自由',
      message: '長らく縛られていたものから解放されるきっかけが来る日。その気づきを大切に。',
      lucky: '開けた場所',
    },
  },
  {
    id: 'tower',
    name: '塔',
    number: 'XVI',
    filename: `${omikujiFolder}Tower.png`,
    upright: {
      keyword: '崩壊・突然の変化・解放',
      message: '予想外の出来事が起きるかもしれないが、それは新しい基盤を作るための変化。動じずに受け止めよう。',
      lucky: '柔軟な靴',
    },
    reversed: {
      keyword: '変化の回避・内的崩壊・先延ばし',
      message: '避け続けていたことと向き合う時が来ている。小さな崩壊で済むうちに対処しよう。',
      lucky: '素直な心',
    },
  },
  {
    id: 'star',
    name: '星',
    number: 'XVII',
    filename: `${omikujiFolder}Star.png`,
    upright: {
      keyword: '希望・癒し・インスピレーション',
      message: '今日は希望の光が差し込む日。素直な気持ちで夢を描くと、不思議と道が開けてくる。',
      lucky: '星型のもの',
    },
    reversed: {
      keyword: '希望の喪失・自己不信・現実逃避',
      message: '希望を見失いかけているかもしれない。今日は小さな良いことに目を向けてみよう。',
      lucky: '空を見上げること',
    },
  },
  {
    id: 'moon',
    name: '月',
    number: 'XVIII',
    filename: `${omikujiFolder}Moon.png`,
    upright: {
      keyword: '幻想・直感・潜在意識',
      message: '今日は見えない世界からのメッセージが届く日。夢や直感を大切にしよう。',
      lucky: 'ムーンストーン',
    },
    reversed: {
      keyword: '混乱・恐れ・誤解',
      message: '不安や恐れが判断を曇らせている。今日は事実だけを見るよう意識しよう。',
      lucky: '明るい場所',
    },
  },
  {
    id: 'sun',
    name: '太陽',
    number: 'XIX',
    filename: `${omikujiFolder}Sun.png`,
    upright: {
      keyword: '成功・喜び・活力',
      message: '今日は最高の輝きを放てる日。自分らしく堂々と生きることで全てがうまく回る。',
      lucky: 'サングラス',
    },
    reversed: {
      keyword: '停滞・過信・エネルギー不足',
      message: '調子が出にくいかもしれないが、太陽の力は必ずある。焦らず光を待とう。',
      lucky: '日光浴',
    },
  },
  {
    id: 'judgement',
    name: '審判',
    number: 'XX',
    filename: `${omikujiFolder}Judgement.png`,
    upright: {
      keyword: '覚醒・再生・呼びかけ',
      message: '今日は本当の自分に気づく日。過去を清算し、新しい自分として生まれ変わるチャンス。',
      lucky: 'トランペットの音',
    },
    reversed: {
      keyword: '自己批判・過去への執着・決断の先延ばし',
      message: '過去の失敗にとらわれすぎていないか。自分を許すことが今日の一番の課題。',
      lucky: '許しの言葉',
    },
  },
  {
    id: 'world',
    name: '世界',
    number: 'XXI',
    filename: `${omikujiFolder}World.png`,
    upright: {
      keyword: '完成・達成・統合',
      message: '今日は一つの完成を迎える記念すべき日。積み重ねてきたものが結実する瞬間を楽しもう。',
      lucky: '地球儀',
    },
    reversed: {
      keyword: '未完成・達成感の欠如・先送り',
      message: 'もう少しで完成なのに踏み切れていないかもしれない。最後の一歩を踏み出そう。',
      lucky: 'ゴールテープ',
    },
  },
];
