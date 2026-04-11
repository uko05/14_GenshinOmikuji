// horoscope.js

export function getZodiac(month, day) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return 'gemini';
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 23)) return 'libra';
  if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) return 'scorpio';
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces';
}

export const horoscope = {
  aries: {
    name: '牡羊座', nameEn: 'Aries', symbol: '♈', period: '3/21〜4/19', periodEn: 'Mar 21 – Apr 19',
    overall: [
      '行動力が高まる一日。思い切って踏み出すと良い結果が生まれる。',
      'エネルギーに満ちた日。新しいことへの挑戦が吉と出る。',
      '直感を信じて動こう。迷いを捨てることが今日のカギ。',
    ],
    overall_en: [
      "Your motivation soars today. Taking a bold step forward will bring great results.",
      "A day full of energy. Challenging something new promises good fortune.",
      "Trust your instincts and act. Letting go of hesitation is the key to today.",
    ],
    love: [
      '積極的なアプローチが吉。好意は素直に伝えよう。',
      '情熱が高まる日。パートナーとの絆を深めるチャンス。',
      '恋愛運は上向き。気になる相手への一歩を踏み出して。',
    ],
    love_en: [
      "An assertive approach brings good luck in love. Express your feelings honestly.",
      "Passion runs high today. A great chance to deepen your bond with your partner.",
      "Love fortune is on the rise. Take that first step toward someone you're interested in.",
    ],
    work: [
      'リーダーシップを発揮できる場面が来る。自信を持って。',
      'スピード感が大事な日。素早い判断が成果を生む。',
      '仕事への熱意が周囲に好印象を与える。積極的に動こう。',
    ],
    work_en: [
      "A moment to show your leadership will arrive. Trust yourself.",
      "Speed matters today. Quick decisions lead to results.",
      "Your enthusiasm makes a great impression on those around you. Stay proactive.",
    ],
    health: [
      '体力充実。適度な運動で活力を維持しよう。',
      '頑張りすぎに注意。こまめな休憩が大切な日。',
      'エネルギーが高い日。外での活動が気分をリフレッシュさせる。',
    ],
    health_en: [
      "You're full of vitality. Keep your energy up with moderate exercise.",
      "Be careful not to overdo it. Taking regular breaks is important today.",
      "Your energy is high. Getting outdoors will refresh your mind and body.",
    ],
    luckyColor: ['赤', '白', 'オレンジ'],
    luckyColor_en: ['Red', 'White', 'Orange'],
    luckyItem: ['スポーツウェア', '新しいノート', '赤いアクセサリー'],
    luckyItem_en: ['Sportswear', 'New notebook', 'Red accessory'],
    luckyNumber: [1, 9, 3],
  },
  taurus: {
    name: '牡牛座', nameEn: 'Taurus', symbol: '♉', period: '4/20〜5/20', periodEn: 'Apr 20 – May 20',
    overall: [
      '安定した一日。コツコツ積み上げてきたことが実を結ぶ。',
      '落ち着いた判断が吉。焦らずじっくり取り組もう。',
      '心地よいペースで過ごせる日。美しいものに触れると運気が上がる。',
    ],
    overall_en: [
      "A stable day. The steady effort you've been putting in is beginning to pay off.",
      "Calm judgment serves you well. Take your time and work through things carefully.",
      "A day to enjoy at your own comfortable pace. Surrounding yourself with beauty lifts your fortune.",
    ],
    love: [
      '誠実な姿勢が相手の心を動かす。ゆっくり距離を縮めよう。',
      '安心感を与えることが今日のテーマ。そばにいるだけで伝わる。',
      '好きな人との食事や会話が縁をつなぐ。美味しいものを共有して。',
    ],
    love_en: [
      "Your sincerity will move the other person's heart. Close the distance slowly.",
      "Bringing a sense of security is your theme today. Just being there says it all.",
      "Sharing a meal or conversation with someone you like strengthens the connection.",
    ],
    work: [
      '粘り強さが評価される日。地道な作業が大きな成果につながる。',
      '信頼の積み重ねが実を結ぶ。丁寧な仕事ぶりを見せよう。',
      '計画通りに進める力が光る日。焦らず確実にこなしていこう。',
    ],
    work_en: [
      "Your persistence is recognized today. Steady work leads to big results.",
      "Your accumulated trust bears fruit. Let your careful work speak for itself.",
      "Your ability to follow a plan shines today. Move steadily and without rushing.",
    ],
    health: [
      '消化器系に気をつけて。食事はゆっくり味わおう。',
      '体を動かすより休息が優先の日。十分な睡眠を。',
      '自然の中を歩くと心身ともにリフレッシュできる。',
    ],
    health_en: [
      "Take care of your digestion. Eat slowly and savor your food.",
      "Rest takes priority over exercise today. Get plenty of sleep.",
      "A walk in nature will refresh both body and mind.",
    ],
    luckyColor: ['緑', 'ピンク', 'クリーム'],
    luckyColor_en: ['Green', 'Pink', 'Cream'],
    luckyItem: ['スイーツ', '観葉植物', '柔らかいブランケット'],
    luckyItem_en: ['Sweets', 'Houseplant', 'Soft blanket'],
    luckyNumber: [2, 6, 4],
  },
  gemini: {
    name: '双子座', nameEn: 'Gemini', symbol: '♊', period: '5/21〜6/21', periodEn: 'May 21 – Jun 21',
    overall: [
      '情報収集力が光る一日。好奇心のままに動くと面白い発見がある。',
      'コミュニケーション運絶好調。人との会話から運気が開ける。',
      'アイデアが湧き出る日。思いついたことをどんどんメモしよう。',
    ],
    overall_en: [
      "Your information-gathering skills shine today. Following your curiosity leads to interesting discoveries.",
      "Communication fortune is at its peak. A conversation with someone opens new opportunities.",
      "Ideas flow freely today. Jot down everything that comes to mind.",
    ],
    love: [
      '軽快なトークで相手の心をつかもう。笑わせた勝ち。',
      'フレンドリーな雰囲気が好印象を生む。自然体でいよう。',
      '複数の出会いがある日。広い交流が縁を引き寄せる。',
    ],
    love_en: [
      "Charm them with lively conversation. Making them laugh is a winning move.",
      "A friendly and natural attitude leaves a great impression. Just be yourself.",
      "A day with multiple potential encounters. Broad social connections attract good fortune.",
    ],
    work: [
      '複数の仕事を同時進行できる日。マルチタスクが得意なあなたの本領発揮。',
      '情報共有が鍵。チームへの連絡をこまめにしよう。',
      '新しいアイデアを積極的に提案して。評価される可能性が高い。',
    ],
    work_en: [
      "You can handle multiple tasks at once today. Time to show your multitasking talent.",
      "Information sharing is key. Keep the communication flowing with your team.",
      "Proactively pitch your new ideas. The chances of being recognized are high.",
    ],
    health: [
      '神経が疲れやすい日。デジタルデトックスを意識して。',
      '気分転換が大切。場所を変えるだけでリフレッシュできる。',
      '手や肩のストレッチを忘れずに。',
    ],
    health_en: [
      "Your nerves may tire easily today. Be mindful of a digital detox.",
      "A change of scenery is important. Simply moving to a different place can refresh you.",
      "Don't forget to stretch your hands and shoulders.",
    ],
    luckyColor: ['黄色', 'ライトブルー', 'シルバー'],
    luckyColor_en: ['Yellow', 'Light blue', 'Silver'],
    luckyItem: ['メモ帳', 'イヤホン', '文庫本'],
    luckyItem_en: ['Notepad', 'Earphones', 'Paperback book'],
    luckyNumber: [3, 5, 7],
  },
  cancer: {
    name: '蟹座', nameEn: 'Cancer', symbol: '♋', period: '6/22〜7/22', periodEn: 'Jun 22 – Jul 22',
    overall: [
      '感受性が豊かな一日。大切な人との時間を丁寧に過ごそう。',
      '直感が冴える日。心が感じることに正直に従おう。',
      '家や身近な場所での出来事が幸運を呼ぶ。',
    ],
    overall_en: [
      "A day of heightened sensitivity. Spend quality time with the people who matter most.",
      "Your intuition is sharp. Follow what your heart tells you.",
      "Events close to home or in familiar places bring good fortune.",
    ],
    love: [
      '相手の気持ちに寄り添う力が光る日。優しさが伝わる。',
      '感情を素直に表現することで距離が縮まる。',
      '思い出の場所での再会や連絡が縁をつなぐ。',
    ],
    love_en: [
      "Your ability to empathize shines today. Your kindness reaches the other person.",
      "Expressing your emotions openly closes the distance.",
      "A reunion or message connected to a meaningful place renews a bond.",
    ],
    work: [
      'チームの雰囲気を読む力が評価される。縁の下の力持ちとして輝こう。',
      '過去の経験が今日の仕事に活きる。自分のやり方を信じて。',
      '丁寧なフォローアップが信頼につながる日。',
    ],
    work_en: [
      "Your ability to read the team atmosphere is recognized. Shine as the unsung hero.",
      "Past experience serves you well in today's work. Trust your own approach.",
      "Careful follow-up builds trust today.",
    ],
    health: [
      '胃腸を労わろう。温かいものを食べると吉。',
      '感情の波に体が影響されやすい日。感じすぎたら休憩して。',
      '水回りや入浴でリフレッシュすると気分が整う。',
    ],
    health_en: [
      "Be gentle with your stomach. Eating something warm is good fortune.",
      "Your body is easily affected by emotional waves today. If you feel overwhelmed, rest.",
      "Refreshing yourself with water — bathing or being near it — settles your mood.",
    ],
    luckyColor: ['白', 'シルバー', '水色'],
    luckyColor_en: ['White', 'Silver', 'Sky blue'],
    luckyItem: ['手紙', '温かい飲み物', '月のモチーフ'],
    luckyItem_en: ['Letter', 'Warm drink', 'Moon motif'],
    luckyNumber: [2, 7, 4],
  },
  leo: {
    name: '獅子座', nameEn: 'Leo', symbol: '♌', period: '7/23〜8/22', periodEn: 'Jul 23 – Aug 22',
    overall: [
      '自信と輝きに満ちた一日。あなたの存在感が場を明るくする。',
      'スポットライトが当たる日。積極的に自分をアピールしよう。',
      '創造性が爆発する日。表現することを恐れずに。',
    ],
    overall_en: [
      "A day full of confidence and radiance. Your presence brightens the whole room.",
      "The spotlight is on you today. Step forward and show the world what you've got.",
      "Your creativity explodes today. Don't be afraid to express yourself.",
    ],
    love: [
      '堂々とした姿が相手を引きつける。自信を持って。',
      '特別な体験を共にすることで絆が深まる。',
      '情熱的な気持ちを率直に伝えると吉。',
    ],
    love_en: [
      "Your commanding presence draws people in. Carry yourself with confidence.",
      "Sharing a special experience deepens the bond.",
      "Conveying your passionate feelings directly brings good luck.",
    ],
    work: [
      'リーダーとしての才能が輝く日。チームを引っ張ろう。',
      'プレゼンや発表に最適な日。堂々と自分の意見を述べよう。',
      'クリエイティブな仕事で本領発揮。アイデアを大胆に出して。',
    ],
    work_en: [
      "Your leadership talent shines today. Lead the team with confidence.",
      "Today is perfect for presentations or pitches. State your ideas boldly.",
      "Creative work is where you truly excel today. Put your boldest ideas out there.",
    ],
    health: [
      '心臓と背中に気をつけて。無理しすぎない一日を。',
      'パワーが満ちている日。体を動かすと運気も上がる。',
      '日光を浴びると活力がわいてくる。外に出よう。',
    ],
    health_en: [
      "Take care of your back and heart. Avoid pushing yourself too hard today.",
      "Your energy is at full power. Moving your body also lifts your fortune.",
      "Soaking up sunlight revitalizes you. Get outside.",
    ],
    luckyColor: ['ゴールド', 'オレンジ', 'レッド'],
    luckyColor_en: ['Gold', 'Orange', 'Red'],
    luckyItem: ['アクセサリー', 'サングラス', 'ゴールドのもの'],
    luckyItem_en: ['Accessories', 'Sunglasses', 'Something gold'],
    luckyNumber: [1, 5, 9],
  },
  virgo: {
    name: '乙女座', nameEn: 'Virgo', symbol: '♍', period: '8/23〜9/22', periodEn: 'Aug 23 – Sep 22',
    overall: [
      '細部への注意力が光る一日。丁寧さが信頼を生む。',
      '分析力が冴える日。計画を立て直すのに最適。',
      '整理整頓や掃除が運気を上げる。環境を整えよう。',
    ],
    overall_en: [
      "Your attention to detail shines today. Thoroughness builds trust.",
      "Your analytical skills are sharp. A great day to revisit and refine your plans.",
      "Tidying up and organizing raises your fortune. Put your environment in order.",
    ],
    love: [
      'さりげない気遣いが相手の心に届く日。',
      '真剣に向き合う姿勢が好感度を上げる。',
      '相手の細かい変化に気づいてあげると距離が縮まる。',
    ],
    love_en: [
      "A small, thoughtful gesture reaches the other person's heart today.",
      "A sincere attitude raises your appeal.",
      "Noticing subtle changes in your partner helps close the distance.",
    ],
    work: [
      'ミスを見つけて修正する力が光る。チェック業務は今日がベスト。',
      '効率化のアイデアが浮かびやすい日。提案してみよう。',
      '地道な作業が大きな成果につながる。コツコツ取り組もう。',
    ],
    work_en: [
      "Your ability to spot and correct errors shines today. Perfect for checking and reviewing.",
      "Ideas for greater efficiency come easily today. Pitch them.",
      "Steady, meticulous work leads to great results. Keep at it.",
    ],
    health: [
      '消化器系のケアを意識して。腹八分目を守ろう。',
      '規則正しい生活が今日の運気を支える。',
      'デトックスに良い日。水分補給をしっかりと。',
    ],
    health_en: [
      "Be mindful of your digestive system. Stop eating when you're 80% full.",
      "A regular routine supports your fortune today.",
      "A good day to detox. Stay well hydrated.",
    ],
    luckyColor: ['紺', 'グリーン', 'ベージュ'],
    luckyColor_en: ['Navy', 'Green', 'Beige'],
    luckyItem: ['手帳', '観葉植物', '整理グッズ'],
    luckyItem_en: ['Planner', 'Houseplant', 'Organizer'],
    luckyNumber: [6, 2, 8],
  },
  libra: {
    name: '天秤座', nameEn: 'Libra', symbol: '♎', period: '9/23〜10/23', periodEn: 'Sep 23 – Oct 23',
    overall: [
      'バランス感覚が光る一日。対人関係が円滑に進む。',
      '美的センスが冴える日。センスを活かした行動が吉。',
      '調和を大切にすることで場の雰囲気がよくなる。',
    ],
    overall_en: [
      "Your sense of balance shines today. Interpersonal relationships flow smoothly.",
      "Your aesthetic sense is sharp. Acting on your taste brings good fortune.",
      "Valuing harmony improves the atmosphere around you.",
    ],
    love: [
      '相手の立場に立って考えることで関係が深まる。',
      'オシャレな場所やデートプランが縁を引き寄せる。',
      '素直に「一緒にいたい」と伝えることが大切な日。',
    ],
    love_en: [
      "Putting yourself in the other person's shoes deepens the relationship.",
      "A stylish venue or date plan attracts a meaningful connection.",
      "Honestly saying 'I want to be with you' is what matters today.",
    ],
    work: [
      '交渉や調整役として力を発揮できる日。',
      'チームワークで大きな成果を生み出せる。協力を求めよう。',
      '公平な判断力が周囲からの信頼を得る。',
    ],
    work_en: [
      "A day to shine as a negotiator or mediator.",
      "Teamwork generates great results. Don't hesitate to ask for help.",
      "Your fair-minded judgment earns the trust of those around you.",
    ],
    health: [
      '腰や腎臓に気をつけて。ストレッチを忘れずに。',
      '心のバランスが体調に直結する日。好きなことで気分転換を。',
      'きれいな環境にいると調子が上がる。空間を整えよう。',
    ],
    health_en: [
      "Take care of your lower back and kidneys. Don't skip your stretches.",
      "Your mental balance directly affects your physical condition today. Unwind with what you enjoy.",
      "Being in a clean and pleasant space boosts your mood. Tidy up your surroundings.",
    ],
    luckyColor: ['ピンク', 'ライトブルー', 'ホワイト'],
    luckyColor_en: ['Pink', 'Light blue', 'White'],
    luckyItem: ['鏡', 'アロマ', 'ペアグッズ'],
    luckyItem_en: ['Mirror', 'Aroma', 'Pair item'],
    luckyNumber: [6, 4, 2],
  },
  scorpio: {
    name: '蠍座', nameEn: 'Scorpio', symbol: '♏', period: '10/24〜11/22', periodEn: 'Oct 24 – Nov 22',
    overall: [
      '洞察力が鋭い一日。物事の本質を見抜く力が光る。',
      '深いところから力が湧いてくる日。集中力を発揮しよう。',
      '変化を恐れず受け入れることで新しい扉が開く。',
    ],
    overall_en: [
      "A day of razor-sharp insight. Your ability to see to the heart of things is at its peak.",
      "Power wells up from deep within today. Channel it into focused concentration.",
      "Embracing change without fear opens a new door.",
    ],
    love: [
      '感情の深さが相手を引きつける。一途な思いを大切に。',
      '秘密の共有が絆を深める。本音で話せる関係を育もう。',
      '情熱的なアプローチが相手の心を揺さぶる日。',
    ],
    love_en: [
      "The depth of your feelings draws people in. Cherish your wholehearted devotion.",
      "Sharing secrets deepens the bond. Nurture a relationship where you can be real.",
      "A passionate approach moves the other person's heart today.",
    ],
    work: [
      '徹底的に取り組む姿勢が評価される。妥協せず進もう。',
      '裏側の情報や真実を掴む力が仕事に活きる。',
      '集中力が最高潮の日。難しい課題に挑戦するなら今日。',
    ],
    work_en: [
      "Your relentless dedication earns recognition. Press forward without compromise.",
      "Your ability to uncover hidden truths and information serves you well.",
      "Your concentration is at its peak today. If there's a difficult challenge, take it on now.",
    ],
    health: [
      '生殖器系・泌尿器系のケアを意識して。水分をしっかり摂ろう。',
      '感情の浄化が大切な日。運動や入浴でリセットを。',
      '無理に明るく振る舞わず、自分の感情に正直に。',
    ],
    health_en: [
      "Be mindful of your reproductive and urinary systems. Stay well hydrated.",
      "Emotional cleansing is important today. Reset with exercise or a bath.",
      "No need to force a cheerful façade. Be honest with your feelings.",
    ],
    luckyColor: ['深紅', '黒', 'パープル'],
    luckyColor_en: ['Crimson', 'Black', 'Purple'],
    luckyItem: ['パワーストーン', '深い色のアイテム', '鍵'],
    luckyItem_en: ['Power stone', 'Deep-colored item', 'Key'],
    luckyNumber: [8, 0, 9],
  },
  sagittarius: {
    name: '射手座', nameEn: 'Sagittarius', symbol: '♐', period: '11/23〜12/21', periodEn: 'Nov 23 – Dec 21',
    overall: [
      '自由と冒険の風が吹く一日。遠くに目を向けると運気が開ける。',
      '楽観的な気持ちが幸運を引き寄せる日。前向きに行こう。',
      '学びや旅への好奇心が才能を伸ばす。新しい世界に飛び込もう。',
    ],
    overall_en: [
      "A day when winds of freedom and adventure blow. Looking far into the distance opens your fortune.",
      "An optimistic spirit attracts good luck today. Stay positive.",
      "Curiosity toward learning and travel stretches your talents. Dive into a new world.",
    ],
    love: [
      '自由な雰囲気がモテの秘訣。縛らない関係が愛を育む。',
      '共通の趣味や夢から縁が広がる。語り合おう。',
      '遠距離や異文化の出会いに注目の日。',
    ],
    love_en: [
      "A free-spirited vibe is your secret charm. A relationship without constraints nurtures love.",
      "Shared hobbies and dreams expand your connections. Open up and talk.",
      "Keep an eye out for long-distance or cross-cultural encounters today.",
    ],
    work: [
      '大きなビジョンを描くことが今日の仕事のカギ。',
      '行動力と発信力が評価される。アイデアをどんどん出そう。',
      '海外や新分野へのチャレンジが吉と出る日。',
    ],
    work_en: [
      "Painting a big picture is the key to work today.",
      "Your drive and communication skills are recognized. Keep those ideas coming.",
      "Challenging overseas projects or new fields promises good fortune today.",
    ],
    health: [
      '太もも・腰のストレッチが吉。アウトドアな活動が合う日。',
      '活発に動きすぎてケガに注意。足元を確認しよう。',
      '遠出や旅行が心のリフレッシュになる。',
    ],
    health_en: [
      "Stretching your thighs and hips is beneficial. A day suited to outdoor activities.",
      "Be careful not to overexert yourself and risk injury. Watch your step.",
      "A day trip or short travel refreshes your spirit.",
    ],
    luckyColor: ['紫', 'ロイヤルブルー', 'オレンジ'],
    luckyColor_en: ['Purple', 'Royal blue', 'Orange'],
    luckyItem: ['地図', '矢印モチーフ', '旅グッズ'],
    luckyItem_en: ['Map', 'Arrow motif', 'Travel goods'],
    luckyNumber: [3, 9, 7],
  },
  capricorn: {
    name: '山羊座', nameEn: 'Capricorn', symbol: '♑', period: '12/22〜1/19', periodEn: 'Dec 22 – Jan 19',
    overall: [
      '努力が着実に実を結ぶ一日。地道に積み上げてきたことを信じよう。',
      '目標に向かって粘り強く進める日。諦めなければ道は開ける。',
      '責任感と誠実さが今日の運気を支える。',
    ],
    overall_en: [
      "A day when your efforts steadily bear fruit. Trust in the work you've quietly been putting in.",
      "A day to push persistently toward your goals. The path opens to those who don't give up.",
      "Your sense of responsibility and integrity support today's fortune.",
    ],
    love: [
      '誠実なアプローチが長期的な信頼を生む。焦らず着実に。',
      '一緒に目標を持てる相手との縁が深まる。',
      '時間をかけて築いた関係に喜びが訪れる。',
    ],
    love_en: [
      "A sincere approach builds long-term trust. Be steady, not rushed.",
      "A bond deepens with someone who shares your goals and ambitions.",
      "A relationship built over time brings joy today.",
    ],
    work: [
      '計画的に動くことで確実に成果が出る日。',
      '責任ある役割を任されるかもしれない。自信を持って受けて。',
      '長期プロジェクトに良い進展がある。粘り勝ちの日。',
    ],
    work_en: [
      "Acting with a plan delivers reliable results today.",
      "You may be entrusted with a position of responsibility. Accept it with confidence.",
      "A long-term project sees positive progress. Persistence wins the day.",
    ],
    health: [
      '関節や骨のケアに気をつけて。体を温めることが吉。',
      '疲れが出やすい日。休息を優先しよう。',
      '規律ある生活リズムが体調を整える。早寝早起きを意識して。',
    ],
    health_en: [
      "Take care of your joints and bones. Keeping warm is beneficial.",
      "Fatigue may set in easily today. Prioritize rest.",
      "A disciplined daily rhythm keeps your health in check. Aim for early to bed, early to rise.",
    ],
    luckyColor: ['ダークグリーン', 'ネイビー', 'ブラウン'],
    luckyColor_en: ['Dark green', 'Navy', 'Brown'],
    luckyItem: ['時計', '革製品', '山や石のモチーフ'],
    luckyItem_en: ['Watch', 'Leather goods', 'Mountain or stone motif'],
    luckyNumber: [4, 8, 10],
  },
  aquarius: {
    name: '水瓶座', nameEn: 'Aquarius', symbol: '♒', period: '1/20〜2/18', periodEn: 'Jan 20 – Feb 18',
    overall: [
      '独創的なアイデアが光る一日。常識にとらわれない発想が吉。',
      '未来志向のエネルギーが高まる日。新しいことを始めるなら今。',
      '個性を大切にすることで本当の仲間が集まってくる。',
    ],
    overall_en: [
      "A day when original ideas shine. Thinking outside the box brings good fortune.",
      "Future-oriented energy surges today. If you're going to start something new, now's the time.",
      "Embracing your individuality brings the right people to your side.",
    ],
    love: [
      '友達から発展する縁に注目の日。フレンドリーに接しよう。',
      '自分らしさを出すことで相手に刺さる。個性が武器。',
      '思いがけない出会いが今日の恋愛運のカギ。',
    ],
    love_en: [
      "Today, pay attention to connections that grow from friendship. Be approachable.",
      "Letting your true self show resonates with the right person. Individuality is your strength.",
      "An unexpected encounter holds the key to your love fortune today.",
    ],
    work: [
      '斬新なアイデアが職場に新しい風を吹かせる。',
      'テクノロジーや最新トレンドを活かした仕事が吉。',
      'チームの常識を変えるような提案ができる日。',
    ],
    work_en: [
      "A fresh idea brings a new breeze to your workplace.",
      "Leveraging technology and the latest trends is a winning move at work.",
      "A day when you can make a proposal that challenges the team's conventional thinking.",
    ],
    health: [
      'ふくらはぎや足首のケアを意識して。',
      '精神的な自由が体調に影響する日。縛られすぎないようにして。',
      '友人との交流がエネルギーを補充してくれる。',
    ],
    health_en: [
      "Pay attention to your calves and ankles.",
      "Mental freedom affects your physical condition today. Try not to feel too constrained.",
      "Time with friends recharges your energy.",
    ],
    luckyColor: ['水色', 'シルバー', 'ターコイズ'],
    luckyColor_en: ['Sky blue', 'Silver', 'Turquoise'],
    luckyItem: ['ガジェット', '星モチーフ', '新しいアプリ'],
    luckyItem_en: ['Gadget', 'Star motif', 'New app'],
    luckyNumber: [7, 11, 4],
  },
  pisces: {
    name: '魚座', nameEn: 'Pisces', symbol: '♓', period: '2/19〜3/20', periodEn: 'Feb 19 – Mar 20',
    overall: [
      '感受性と直感が研ぎ澄まされる一日。夢と現実が交差する不思議な日。',
      '芸術や創造的な活動に運気が乗る日。感性を活かそう。',
      '人の気持ちに寄り添う力が光る。思いやりが幸運を呼ぶ。',
    ],
    overall_en: [
      "A day of heightened sensitivity and intuition — where dreams and reality intersect in a magical way.",
      "Fortune flows into artistic and creative activities today. Let your senses lead you.",
      "Your empathy shines brightly. Compassion and kindness call good fortune to you.",
    ],
    love: [
      '夢見がちな気持ちが相手を引きつける。ロマンを大切に。',
      '感情を共有することで深い絆が生まれる日。',
      '言葉より雰囲気で気持ちを伝えると伝わりやすい日。',
    ],
    love_en: [
      "Your dreamy quality draws people in. Hold on to your romantic spirit.",
      "Sharing emotions creates a deep bond today.",
      "Expressing your feelings through atmosphere rather than words comes across more clearly today.",
    ],
    work: [
      '芸術・クリエイティブ・ケアの仕事で才能が輝く。',
      '直感を信じた判断が正解につながる日。',
      '自分のペースで進める仕事が最もはかどる。',
    ],
    work_en: [
      "Your talents shine in art, creative work, and caregiving.",
      "A day when trusting your intuition leads to the right answer.",
      "Work you can do at your own pace progresses best today.",
    ],
    health: [
      '足のケアを忘れずに。温かい足湯が吉。',
      '感情と体調がリンクしやすい日。心が安らぐ環境を整えて。',
      '過度な飲酒・刺激物に注意。デリケートな日。',
    ],
    health_en: [
      "Don't neglect your feet. A warm foot bath is beneficial.",
      "Your emotions and physical condition are closely linked today. Create a calm environment.",
      "Be careful of excessive alcohol or stimulants. A delicate day.",
    ],
    luckyColor: ['シーグリーン', 'ラベンダー', 'ホワイト'],
    luckyColor_en: ['Sea green', 'Lavender', 'White'],
    luckyItem: ['海のモチーフ', 'アロマオイル', '音楽'],
    luckyItem_en: ['Ocean motif', 'Aroma oil', 'Music'],
    luckyNumber: [7, 2, 12],
  },
};
