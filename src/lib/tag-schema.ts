/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Faceted Sociolinguistic Tagging Taxonomy
 * Expanded for Belarusian & Eastern European contact environments.
 */

// 1. Base Code Axis (Terracotta - exactly one per turn)
export type BaseCodeType = 
  | 'bel'        // Литературный / унормированный белорусский язык
  | 'ru'         // Литературный / унормированный русский язык
  | 'trasianka'  // Трасянка (смешанный русско-белорусский интерферентный код)
  | 'prosta'     // Простая мова (смешанная народно-диалектная речь без доминирования нормы)
  | 'foreign'    // Иностранный этнолект / код (мигранты, иностранные студенты, напр. русско-китайский)
  | 'polish';    // Преимущественно польский код (говор / смешение)

// 2. Register Axis (Ochre - multiple per turn)
export type RegisterType =
  | 'colloquial' // Обыденно-разговорный регистр
  | 'official'   // Официально-деловой / канцеляризмы в устной речи
  | 'religious'  // Религиозный регистр (конфессиональные молитвенные формулы / паны)
  | 'folk';       // Фольклорно-обрядовый регистр (песни, заговоры, этнокульт)

// 3. Contact Axis (Green - applied precisely to word/span)
export type ContactPhenomenonType =
  | 'polonism'   // Полонизм (польские заимствования / фонетические кальки)
  | 'baltism'    // Балтизм (литовские/балтийские элементы Гродненщины и Виленщины)
  | 'ukrainism'  // Украинизм / полесский суржик (присущ Брестчине / Гомельщине)
  | 'ru-in-bel'  // Точечный русизм в белорусском окружении
  | 'bel-in-ru'  // Точечный белорусизм (фонетический или лексический) в русском окружении
  | 'cm';        // Code mixing (внутрифразовое хаотическое смешение элементов)

// 4. Discourse Axis (Grey - applied precisely to word/span)
export type DiscourseType =
  | 'cs'         // Межфразовое переключение кодов (code switching)
  | 'marker'     // Дискурсивный маркер (частицы "дык", "ну", "вось", "ай", "ото")
  | 'parenthesis'; // Вводные слова / конструкции (напр. "значит", "правда", "кажуць")

// 5. Sociolect Axis (Indigo - assigned once at speaker level)
export type SociolectType =
  | 'older_gen'   // Старшее поколение (архаичный сельский говор, традиционный этнолект)
  | 'urban_shift' // Городской сдвиг (переход сельского диалекта в городское просторечие)
  | 'young_shift' // Молодежный сдвиг (урбанистическая русскоязычная смесь, сленг);

/**
 * Operational definitions of tags with examples for kappa (κ) reliability
 */
export interface TagDefinition {
  id: string;
  labelRu: string;
  labelBy: string;
  labelZh: string;
  definitionRu: string;
  definitionBy: string;
  definitionZh: string;
  exampleRu: string;
  exampleBy: string;
  axis: 'base' | 'register' | 'contact' | 'discourse' | 'sociolect';
  color: string; // Tailwind styling class cues
}

export const TAG_DEFINITIONS: Record<string, TagDefinition> = {
  // Base Code
  bel: {
    id: 'bel',
    labelRu: 'Белорусский х.',
    labelBy: 'Беларускі х.',
    labelZh: '白俄罗斯文体',
    definitionRu: 'Литературный или унормированный белорусский язык.',
    definitionBy: 'Літаратурная або ўнармаваная беларуская мова.',
    definitionZh: '标准白俄罗斯语规范。',
    exampleRu: '«Прыгожае надвор’е сёння на вуліцы».',
    exampleBy: '«Прыгожае надвор’е сёння на вуліцы».',
    axis: 'base',
    color: 'border-amber-700 bg-amber-50 text-amber-900'
  },
  ru: {
    id: 'ru',
    labelRu: 'Русский х.',
    labelBy: 'Рускі х.',
    labelZh: '俄语变体',
    definitionRu: 'Стандартный русский язык с минимальным региональным акцентом.',
    definitionBy: 'Стандартная руская мова з мінімальным рэгіянальным акцэнтам.',
    definitionZh: '带有极少方言色彩的标准俄语。',
    exampleRu: '«Сегодня отличный день для прогулки».',
    exampleBy: '«Сёння выдатны дзень для прагулкі» (па-руску).',
    axis: 'base',
    color: 'border-orange-700 bg-orange-50 text-orange-900'
  },
  trasianka: {
    id: 'trasianka',
    labelRu: 'Трасянка',
    labelBy: 'Трасянка',
    labelZh: '特拉相卡混合语',
    definitionRu: 'Хаотичное непоследовательное смешение русской лексики с белорусской фонетикой.',
    definitionBy: 'Хаатычнае непаслядоўнае змешванне рускай лексікі з беларускай фанетыкай.',
    definitionZh: '俄语词汇与白俄罗斯语语音机制的自发混合口语。',
    exampleRu: '«Дзеці у горад паехаў каля колеі».',
    exampleBy: '«Дзеці у горад паехаў каля колеі».',
    axis: 'base',
    color: 'border-red-700 bg-red-50 text-red-900'
  },
  prosta: {
    id: 'prosta',
    labelRu: 'Простая мова',
    labelBy: 'Простая мова',
    labelZh: '“简单话”方言',
    definitionRu: 'Традиционные смешанные польско-белорусско-литовские деревенские говоры приграничья.',
    definitionBy: 'Традыцыйныя змяшаныя польска-беларуска-літоўскія вясковыя гаворкі памежжа.',
    definitionZh: '白俄罗斯与波兰、立陶宛边境非标准化的质朴乡村混合土话。',
    exampleRu: '«У нас тут гаворка была простая, туейшая».',
    exampleBy: '«У нас тут гаворка была простая, тутэйшая».',
    axis: 'base',
    color: 'border-amber-800 bg-amber-100 text-amber-950'
  },
  foreign: {
    id: 'foreign',
    labelRu: 'Инофонный код',
    labelBy: 'Інафонны код',
    labelZh: '异源外语接触',
    definitionRu: 'Речь мигрантов или иностранных студентов с выраженным субстратом другого языка.',
    definitionBy: 'Маўленне мігрантаў або замежных студэнтаў з выяўленым субстратам іншай мовы.',
    definitionZh: '留学生、移民或外籍人士交流时形成的特定中介语言（双语切换或底层干涉）。',
    exampleRu: '«Мы обсуждать проект и 听得很清楚 (слышно хорошо)».',
    exampleBy: '«Мы абмяркоўваць праект і 听得很清楚»',
    axis: 'base',
    color: 'border-rose-700 bg-rose-50 text-rose-900'
  },
  polish: {
    id: 'polish',
    labelRu: 'Преимущ. польский',
    labelBy: 'Пераважна польскі',
    labelZh: '波兰语向心性',
    definitionRu: 'Речь, в которой преобладают польские грамматические и лексические основы.',
    definitionBy: 'Маўленне, у якім пераважаюць польскія граматычныя і лексічныя асновы.',
    definitionZh: '波兰语成分主导的口语表现（常伴随宗教或历史语境）。',
    exampleRu: '«Бацька мой спяваў пацера і хадзіў у касцёл».',
    exampleBy: '«Бацька мой спяваў пацера і хадзіў у касцёл».',
    axis: 'base',
    color: 'border-orange-850 bg-orange-100 text-orange-950'
  },

  // Registers
  colloquial: {
    id: 'colloquial',
    labelRu: 'Разговорный',
    labelBy: 'Размоўны',
    labelZh: '日常口语',
    definitionRu: 'Повседневный обиходный стиль устного общения.',
    definitionBy: 'Штодзённы бытавы стыль вусных зносін.',
    definitionZh: '无拘无束的普通家庭、日常交际语。',
    exampleRu: '«Ну да ладно, копать же завтра надо».',
    exampleBy: '«Ну ды ладна, капаць жа заўтра трэба».',
    axis: 'register',
    color: 'border-yellow-700 bg-yellow-50 text-yellow-900'
  },
  official: {
    id: 'official',
    labelRu: 'Официальный',
    labelBy: 'Афіцыйны',
    labelZh: '官方公文体',
    definitionRu: 'Вкрапление канцеляризмов, советских лозунгов или официальных формулировок.',
    definitionBy: 'Украпванне канцылярызмаў, савецкіх лозунгаў або афіцыйных фармулёвак.',
    definitionZh: '访谈中主动夹杂的官方宣教、报刊用语及格式化公文词汇。',
    exampleRu: '«...обращайтесь в установленном порядке в исполком».',
    exampleBy: '«...звяртайцеся ва ўстаноўленым парадку ў выканкам».',
    axis: 'register',
    color: 'border-blue-700 bg-blue-50 text-blue-900'
  },
  religious: {
    id: 'religious',
    labelRu: 'Религиозный',
    labelBy: 'Рэлігійны',
    labelZh: '宗教神圣体',
    definitionRu: 'Использование освященной церковной лексики, молитв или литургических формул.',
    definitionBy: 'Выкарыстанне асвечанай царкоўнай лексікі, малітваў або літургічных формул.',
    definitionZh: '多包含天主教、东正教信众仪式化圣言、歌谣。',
    exampleRu: '«Па-польску маліўся, пацера адмаўляў...»',
    exampleBy: '«Па-польску маліўся, пацера адмаўляў...»',
    axis: 'register',
    color: 'border-violet-700 bg-violet-50 text-violet-900'
  },
  folk: {
    id: 'folk',
    labelRu: 'Фольклорный',
    labelBy: 'Фальклорны',
    labelZh: '民俗仪式体',
    definitionRu: 'Песенно-обрядовый регистр, устное народное поэтическое творчество, заговоры.',
    definitionBy: 'Песенна-абрадавы рэгістр, вусная народная паэтычная творчасць, замовы.',
    definitionZh: '乡野史诗、古民歌、萨满咒语或具有传统仪式感的唱腔音律。',
    exampleRu: '«Ой, рэчанька, рэчанька, чаму ж ты няпоўная...»',
    exampleBy: '«Ой, рэчанька, рэчанька, чаму ж ты няпоўная...»',
    axis: 'register',
    color: 'border-emerald-700 bg-emerald-50 text-emerald-900'
  },

  // Contact Phenomena
  polonism: {
    id: 'polonism',
    labelRu: 'Полонизм',
    labelBy: 'Паланізм',
    labelZh: '波兰语借词',
    definitionRu: 'Лексика из польского (клямка, колейка, цэбар, пацера), нарушающая исходный код.',
    definitionBy: 'Лексіка з польскай мовы (клямка, калейка, цэбар, пацера), якая парушае зыходны код.',
    definitionZh: '波兰语外来词或词序（如 klamka, kolejka, pacierz）。',
    exampleRu: '«колейку стаць» (в очередь встать)',
    exampleBy: '«колейку стаць»',
    axis: 'contact',
    color: 'border-green-600 bg-green-50 text-green-850'
  },
  baltism: {
    id: 'baltism',
    labelRu: 'Балтизм',
    labelBy: 'Балтызм',
    labelZh: '波罗的语底层',
    definitionRu: 'Литовские лексические заимствования или калькирования в речи на северо-западе Беларуси.',
    definitionBy: 'Літоўскія лексічныя запазычанні або калькіраванні ў маўленні на паўночным захадзе Беларусі.',
    definitionZh: '来自立陶宛语或拉脱维亚语的方言接触特征（如 svirnas, rykas）。',
    exampleRu: '«клуня», «лайба», «павець»',
    exampleBy: '«клуня», «лайба», «павець»',
    axis: 'contact',
    color: 'border-teal-600 bg-teal-50 text-teal-850'
  },
  ukrainism: {
    id: 'ukrainism',
    labelRu: 'Украинизм',
    labelBy: 'Украінізм',
    labelZh: '乌克兰杂糅',
    definitionRu: 'Характерные элементы полесских украиноязычных говоров (встречается на юге Беларуси).',
    definitionBy: 'Характэрныя элементы палескіх украінамоўных гаворак (сустракаецца на поўдні Беларусі).',
    definitionZh: '白俄罗斯南部波列西耶地区常见的乌克兰语变种层级特征。',
    exampleRu: '«виноград» па-палеску ці «дывысь»',
    exampleBy: '«выноград» па-палеску ці «дывысь»',
    axis: 'contact',
    color: 'border-lime-700 bg-lime-50 text-lime-900'
  },
  'ru-in-bel': {
    id: 'ru-in-bel',
    labelRu: 'Русизм в бел.',
    labelBy: 'Русізм у бел.',
    labelZh: '融入白语的俄语词',
    definitionRu: 'Интерференционный вброс российского слова или корневой основы посреди белорусской фразы.',
    definitionBy: 'Інтэрферэнцыйны ўкід расійскага слова або каранёвай асновы пасярод беларускай фразы.',
    definitionZh: '在纯白俄罗斯语框架中插入的俄语特有词汇或不当句法构词。',
    exampleRu: '«раней куплялі карандашы (замест аловак)»',
    exampleBy: '«раней куплялі карандашы»',
    axis: 'contact',
    color: 'border-emerald-600 bg-emerald-50 text-emerald-850'
  },
  'bel-in-ru': {
    id: 'bel-in-ru',
    labelRu: 'Белорусизм в рус.',
    labelBy: 'Беларусізм у рус.',
    labelZh: '融入俄语的白语词',
    definitionRu: 'Использование белорусских слов (шуфлядка, дюба, бурак) или жесткого фрикативного [Y] в русской речи.',
    definitionBy: 'Выкарыстанне беларускіх слоў (шуфлядка, дзюба, бурак) або жорсткага фрыкатыўнага [Y] у рускай гаворцы.',
    definitionZh: '俄语会话中夹杂的白俄罗斯语底层发音（如 фрикативный Г / u-неслоговое）或特色方言词。',
    exampleRu: '«положи вилки в шуфлядку»',
    exampleBy: '«палажы вілкі ў шуфлядку»',
    axis: 'contact',
    color: 'border-indigo-600 bg-indigo-50 text-indigo-850'
  },
  cm: {
    id: 'cm',
    labelRu: 'Код-миксинг (CM)',
    labelBy: 'Код-міксінг (CM)',
    labelZh: '词内语码糅合',
    definitionRu: 'Внутрифразовое хаотичное слияние морфологии без явной прагматической границы кодов.',
    definitionBy: 'Унутрыфразавае хаатычнае зліццё марфалогіі без відавочнай прагматычнай мяжы кодаў.',
    definitionZh: '句法或词法交界处，极高频度却不含意图的双语混合机制。',
    exampleRu: '«картоплю копаць хутка нада будзе»',
    exampleBy: '«картоплю копаць хутка нада будзе»',
    axis: 'contact',
    color: 'border-teal-700 bg-teal-50 text-teal-900'
  },

  // Discourse
  cs: {
    id: 'cs',
    labelRu: 'Код-свитч (CS)',
    labelBy: 'Код-світч (CS)',
    labelZh: '跨句语码转换',
    definitionRu: 'Сознательное переключение собеседником законченных предложений или фраз на другую языковую систему.',
    definitionBy: 'Свядомае пераключэнне суразмоўцам скончаных сказаў або фраз на іншую моўную сістэму.',
    definitionZh: '根据语境或交际意图，在完整句式或段落级别切换至另一门完备语言。',
    exampleRu: '«Привет! Как меня слышно? — 听得很清楚，谢谢。»',
    exampleBy: '«Привет! Как меня слышно? — 听得很清楚，谢谢。»',
    axis: 'discourse',
    color: 'border-slate-600 bg-slate-50 text-slate-850'
  },
  marker: {
    id: 'marker',
    labelRu: 'Дискурс-маркер',
    labelBy: 'Дыскарс-маркер',
    labelZh: '话语标记语',
    definitionRu: 'Прагматические сигналы связности речи («дык», «ну», «вось», «так бы мовіць»).',
    definitionBy: 'Прагматычныя сігналы звязнасці маўлення («дык», «ну», «вось», «так бы мовіць»).',
    definitionZh: '表达转折、承接或语流填充的特色语气词（如 дык, вось, ай）。',
    exampleRu: '«Дык вось сяджу колейкі чакаю...»',
    exampleBy: '«Дык вось сяджу колейкі чакаю...»',
    axis: 'discourse',
    color: 'border-stone-600 bg-stone-50 text-stone-850'
  },
  parenthesis: {
    id: 'parenthesis',
    labelRu: 'Вводные слова',
    labelBy: 'Уводныя словы',
    labelZh: '插入语/注记',
    definitionRu: 'Вводные конструкции («канечне», «значит», «ведаеш», «як кажуць»).',
    definitionBy: 'Уводныя канструкцыі («канечне», «значыць», «ведаеш», «як кажуць»).',
    definitionZh: '用于句意缓冲或传闻佐证的固定语码插入。',
    exampleRu: '«беларускую мову ведалі, канечне, але...»',
    exampleBy: '«беларускую мову ведалі, канечне, але...»',
    axis: 'discourse',
    color: 'border-gray-600 bg-gray-50 text-gray-850'
  }
};

/**
 * 1. Speaker Profile Data Structure (Sociolect axis is assigned once per speaker)
 */
export interface SpeakerProfile {
  speakerName: string;
  sociolect: 'older_gen' | 'urban_shift' | 'young_shift' | 'none';
}

/**
 * 2. Position-based precisely targeted text fragment annotation
 */
export interface SpanAnnotation {
  id: string;
  segmentId: string;
  text: string;           // Текст выделенного фрагмента (substring)
  startChar: number;      // Начальный индекс в сегменте
  endChar: number;        // Конечный индекс в сегменте
  tagId: 'polonism' | 'baltism' | 'ukrainism' | 'ru-in-bel' | 'bel-in-ru' | 'cm' | 'cs' | 'marker' | 'parenthesis';
  axis: 'contact' | 'discourse';
  note?: string;          // Дополнительные соображения разметчика
}

/**
 * 3. Structured Turn-level annotation (Faceted)
 */
export interface TurnFacetAnnotation {
  segmentId?: string;
  baseCode: BaseCodeType;
  registers: RegisterType[];
}

/**
 * Active region filter heuristics: Hides/shows Baltisms & Ukrainisms based on geography
 * to maintain clean, high-precision viewport and high Kappa.
 */
export function tagsForRegion(location: string, availableTags: TagDefinition[]): TagDefinition[] {
  const normLoc = location.toLowerCase();
  
  // Ukrainisms belong typical to Brest, Gomel, Polesye
  const isSouthBy = normLoc.includes('брест') || normLoc.includes('гомель') || normLoc.includes('полесь') || normLoc.includes('пинск') || normLoc.includes('мозыр');
  
  // Baltisms belong typical to Grodno, Vilna, Postavy, Oshmyany
  const isNorthWestBy = normLoc.includes('гродно') || normLoc.includes('вилен') || normLoc.includes('постав') || normLoc.includes('ошмян') || normLoc.includes('срэбр') || normLoc.includes('лид');

  return availableTags.filter(tag => {
    if (tag.id === 'ukrainism' && isNorthWestBy && !isSouthBy) {
      // Hide Ukrainisms when deep in Grodno region to avoid human misidentifying Baltisms/Polonisms
      return false;
    }
    if (tag.id === 'baltism' && isSouthBy && !isNorthWestBy) {
      // Hide Baltisms when deep in Polesye region where it's statistically absent
      return false;
    }
    return true;
  });
}

/**
 * Validator of structural correctness
 */
export function validateFacetAnnotation(
  annot: TurnFacetAnnotation, 
  spans: SpanAnnotation[], 
  speakerProfile: SpeakerProfile
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Core Rule: Base code of a turn cannot imply total absence
  if (!annot.baseCode) {
    errors.push('Базовый языковой код фразы (Base Code) должен быть обязательно выбран.');
  }

  // Inter-Facet Validation Rule:
  // If baseCode is Literary Russian or Belarusian but we have deep Code Mixing (cm) span without registration, warn
  const hasCM = spans.some(s => s.tagId === 'cm' && s.segmentId === annot.segmentId);
  if (hasCM && (annot.baseCode === 'ru' || annot.baseCode === 'bel')) {
    // Highly likely is Trasianka or Prosta, but could be a minor citation
  }

  // Validator ensures speaker is assigned a valid category
  if (!speakerProfile.sociolect) {
    errors.push('Каждый спикер устной стенограммы должен иметь сопоставленный социолектный профиль.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
