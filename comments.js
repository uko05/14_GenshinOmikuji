// comments.js
// 総合コメント：運勢レベル × バイオリズム平均の組み合わせ

export const fortuneLevels    = ['大吉', '中吉', '小吉', '末吉', '凶'];
export const fortuneLevels_en = ['Great Fortune', 'Good Fortune', 'Minor Fortune', 'Slight Fortune', 'Misfortune'];

// 運勢レベルに応じた重み（インデックスに対応）
// 大吉:15%, 中吉:30%, 小吉:30%, 末吉:17%, 凶:8%
export const fortuneWeights = [0.15, 0.30, 0.30, 0.17, 0.08];

// ===== 日本語コメント =====
export const comments = {
  大吉: {
    high: [
      '今日はまさに最高の一日！体も心も整っており、何をやってもうまくいく予感がする。自信を持って全力で動こう。',
      'エネルギーと運気が重なる幸運な日。チャンスが来たら迷わずつかんで。あなたの行動が未来を輝かせる。',
    ],
    mid: [
      '大きな幸運が訪れる日。少し体調の波はあるかもしれないが、運気の後押しがそれを補ってくれる。',
      '今日の運勢は申し分なし。調子が万全でなくても、タイミングに恵まれているから大丈夫。',
    ],
    low: [
      '運は最高だが体や感情のコンディションが落ち気味。無理せず動けば、それでも十分なほど運が味方する。',
      '絶好の運気なのに体が重い日。今日は「待ち」の大吉。じっとしているだけで良いことが転がり込んでくる。',
    ],
  },
  中吉: {
    high: [
      '体力も気力も充実していて、運気も追い風。努力したことに対してきちんと結果が出る一日。',
      '安定した幸運の中で力強く前進できる日。地道にやってきたことが今日報われる。',
    ],
    mid: [
      '可もなく不可もなく、だからこそ自分次第の一日。少し意識して動くだけで、中吉以上の結果が出せる。',
      '運気は安定している。大きな波はないが、着実に良い方向へ進んでいる。焦らず行こう。',
    ],
    low: [
      'コンディションは低めだが、運気が下支えしている。今日は頑張りすぎず、流れに身を任せよう。',
      '体や感情が重く感じる日かもしれないが、良い流れは来ている。無理せず受け取る準備を。',
    ],
  },
  小吉: {
    high: [
      '体力はあるが運気はほどほど。今日は実力で切り開く日。自分の力を信じて着実に進もう。',
      'コンディションは上々。少し運気が控えめでも、あなたの行動力でカバーできる一日。',
    ],
    mid: [
      '平穏な一日。特別なことは起きないかもしれないが、それ自体が小さな幸せ。日常を大切に。',
      '今日は無理せず、ゆっくりと過ごすことが吉。小さな喜びを見つけることで運気が上がる。',
    ],
    low: [
      '今日はちょっと休憩モードで良い日。無理に動かず、充電することで明日への力を蓄えよう。',
      '運もコンディションも控えめな日。こういう日は静かに自分を整えることに集中しよう。',
    ],
  },
  末吉: {
    high: [
      '体力はあるが流れが少し硬い日。焦らず、丁寧に行動することで末吉が好転することも。',
      'コンディションは良いのに運がついてこない感じ。今日は実力を蓄える練習の日と思おう。',
    ],
    mid: [
      '今日は慎重さが大切。大きな行動より、確認や準備に時間をかけることが吉。',
      '流れが読みにくい一日。無理に進もうとせず、状況を見守ることが賢明。',
    ],
    low: [
      '今日は無理しないことが一番の吉。休息を大切にして、エネルギーを温存しよう。',
      '体も気力も低め、運気も落ち着いている日。こんな日は何もしないことが最善の選択。',
    ],
  },
  凶: {
    high: [
      '体力はあるが運気は難しい日。動けるからこそ、あえてブレーキを踏む判断が大切。',
      '気持ちは前向きなのに空回りしやすい日。一歩引いて、今日は準備に徹しよう。',
    ],
    mid: [
      '今日は慎重に過ごすのが吉。新しいことは控えめにして、既存のことを丁寧に仕上げよう。',
      '凶といえど、丁寧に過ごせば悪いことは最小限に抑えられる。心穏やかに行こう。',
    ],
    low: [
      '今日はとにかく休もう。無理して動くより、明日への英気を養うことが最善。',
      '運もコンディションも低い日は、静かに過ごすことで運気のリセットができる。明日に期待しよう。',
    ],
  },
};

// ===== 英語コメント =====
export const comments_en = {
  大吉: {
    high: [
      "Truly the best day possible! Your body, mind, and spirit are all aligned, and everything you do is bound to go well. Move forward with full confidence.",
      "A lucky day when energy and fortune converge. When opportunity comes, seize it without hesitation. Your actions will make the future shine.",
    ],
    mid: [
      "A day of great good fortune. You may feel a slight dip in your condition, but the tailwinds of fortune more than make up for it.",
      "Nothing wrong with today's fortune at all. Even if you're not at your best, the timing is in your favor — you'll be just fine.",
    ],
    low: [
      "Your fortune is at its peak, but your body or emotions feel a little sluggish. Move at a gentle pace and fortune will still be firmly on your side.",
      "The best of luck, yet your body feels heavy today. Think of it as a 'waiting' Great Fortune — good things will roll your way simply by staying still.",
    ],
  },
  中吉: {
    high: [
      "Both your physical and mental energy are brimming, and fortune has your back. A day when your hard work pays off with solid results.",
      "A day to push forward with steady good fortune behind you. Something you've been chipping away at will finally come to fruition.",
    ],
    mid: [
      "Neither great nor bad — a day where it all comes down to you. Just a little extra intention in your actions can produce results beyond Good Fortune.",
      "Your fortune is stable. No big waves, but you're steadily moving in a good direction. There's no need to hurry.",
    ],
    low: [
      "Your condition is on the low side, but good fortune is there to support you. Today, trust the flow rather than pushing too hard.",
      "Your body and emotions may feel heavy, but a positive current is coming. Get ready to receive it without overdoing it.",
    ],
  },
  小吉: {
    high: [
      "Your physical energy is high, but fortune is modest. Today is a day to break through with your own ability. Trust yourself and keep moving steadily.",
      "Your condition is excellent. Even with fortune being a little reserved, your drive can more than cover it today.",
    ],
    mid: [
      "A peaceful day. Nothing special may happen, but that itself is a small kind of happiness. Treasure the everyday.",
      "Today, taking it easy and going slowly is the right call. Finding small joys along the way raises your fortune.",
    ],
    low: [
      "Today is a perfectly good day for a little rest mode. Rather than pushing forward, recharging now stores up strength for tomorrow.",
      "Both fortune and condition are on the quieter side today. On days like these, focus quietly on settling and restoring yourself.",
    ],
  },
  末吉: {
    high: [
      "You have the energy but the flow feels a bit stiff today. Moving carefully, without rushing, can still turn Slight Fortune into something better.",
      "Your condition is good, but fortune isn't quite catching up. Think of today as a practice day for building your strength.",
    ],
    mid: [
      "Caution is everything today. Spending time double-checking and preparing, rather than making bold moves, is the right call.",
      "The flow is hard to read today. Rather than forcing your way through, watching and waiting is the wiser choice.",
    ],
    low: [
      "The best fortune today comes from not pushing yourself. Prioritize rest and conserve your energy.",
      "Your body, spirit, and fortune are all on the quieter side today. On days like these, doing nothing may be the wisest choice of all.",
    ],
  },
  凶: {
    high: [
      "You have the energy, but it's a difficult day for fortune. Precisely because you can move, the wise choice is to deliberately pump the brakes.",
      "Your mood is positive, but today is prone to spinning your wheels. Step back and dedicate the day to preparation.",
    ],
    mid: [
      "Treading carefully is the right path today. Hold back on new ventures and focus on finishing existing things with care.",
      "Even with Misfortune, passing the day with mindfulness keeps trouble to a minimum. Move forward with a calm heart.",
    ],
    low: [
      "Above all else, rest today. Rather than pushing through, nurturing your spirit for tomorrow is the best course of action.",
      "When both fortune and condition are low, spending the day quietly allows fortune to reset. Look forward to tomorrow.",
    ],
  },
};
