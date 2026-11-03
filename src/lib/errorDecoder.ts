/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DecodedError {
  code: string;
  title: string;
  reason: string;
  solution: string;
}

export function decodeGeminiError(errorObj: any, lang: 'ru' | 'by' | 'zh' | string): DecodedError {
  const errMsg = (errorObj?.message || errorObj?.toString() || '').toLowerCase();
  const errCode = (errorObj?.error || errorObj?.code || '').toString().toUpperCase();

  // 1. Missing API Key
  if (errCode === 'GEMINI_API_KEY_MISSING' || errMsg.includes('missing') || errMsg.includes('key missing') || errMsg.includes('не задан или является стандартной заглушкой')) {
    return {
      code: 'GEMINI_API_KEY_MISSING',
      title: lang === 'ru' ? 'API-ключ не задан' : lang === 'by' ? 'API-ключ не зададзен' : 'API 密钥未配置',
      reason: lang === 'ru' 
        ? 'Система не обнаружила активного ключа доступа к Gemini API.' 
        : lang === 'by' 
        ? 'Сістэма не знайшла актыўнага ключа доступу да Gemini API.' 
        : '系统未检测到在运行中处于激活状态的 Gemini API 密钥。',
      solution: lang === 'ru'
        ? 'Перейдите на вкладку "05: Расшифровка (онлайн)" (или вставьте ключ во вкладке Безопасность) и введите ваш персональный API-ключ в поле вверху страницы, затем нажмите кнопку сохранения. Также вы можете задать переменную GEMINI_API_KEY в панели "Settings > Secrets" в правом верхнем углу.'
        : lang === 'by'
        ? 'Перайдзіце на ўкладку "05: Расшыфроўка (анлайн)" (ці ўстаўце яго раней у раздзеле Бяспека) і ўвядзіце ваш асабісты API-ключ у поле уверсе, пасля чаго націсніце кнопку захавання. Таксама вы можаце задаць зменную GEMINI_API_KEY ў панэлі "Settings > Secrets" у правым верхнім куце.'
        : '请直接前往 5 号选项卡 “数据安全与 API” 的密钥管理器中，输入以 AIzaSy 开头的专有密钥并点击保存。此外，您也可以在编辑器右上角 Settings > Secrets 面板中将它作为通用环境变量 GEMINI_API_KEY 导入。'
    };
  }

  // 2. Invalid Key
  if (errMsg.includes('api key not valid') || errMsg.includes('invalid') || errMsg.includes('unauthorized') || errMsg.includes('key_invalid') || errMsg.includes('invalid_argument') || errMsg.includes('400')) {
    return {
      code: 'API_KEY_INVALID',
      title: lang === 'ru' ? 'Неверный API-ключ (400 Invalid Key)' : lang === 'by' ? 'Няправільны API-ключ (400 Invalid Key)' : 'API 密钥校验失败 (400 Invalid)',
      reason: lang === 'ru' 
        ? 'Указанный ключ доступа API был отклонен сервером Google (неверная подпись или лимиты проекта).' 
        : lang === 'by' 
        ? 'Пазначаны ключ доступу API быў адхілены серверам Google (няправільная подпіс або ліміты праекта).' 
        : '由于输入的密钥不匹配或您的 Google 开发者项目凭据已被吊销，请求遭远端拒绝。',
      solution: lang === 'ru'
        ? 'Проверьте, что ключ скопирован корректно и без лишних пробелов на концах. Он должен начинаться на буквы "AIzaSy...". Примерные символы на конце не должны содержать кавычки.'
        : lang === 'by'
        ? 'Праверце, што вы скапіявалі ключ правільна, без прабелаў на канцах. Ён павінен пачынацца на літары "AIzaSy...". Прыкладныя сімвалы на канцы не павінны ўтрымліваць двукоссі.'
        : '请进入 Google AI Studio 控制台校验您的密钥并重新保存（确无前后空白符并且以 AIzaSy 开头）。'
    };
  }

  // 3. Quota Exceeded / Too many requests
  if (errMsg.includes('resource_exhausted') || errMsg.includes('exhausted') || errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('too many requests') || errMsg.includes('rate_limit') || errMsg.includes('limit')) {
    return {
      code: 'RESOURCE_EXHAUSTED_429',
      title: lang === 'ru' ? 'Превышен лимит запросов (429 Rate Limit)' : lang === 'by' ? 'Перавышаны ліміт запытаў (429 Rate Limit)' : '请求过于频繁或超出配额 (429 Rate Limit)',
      reason: lang === 'ru' 
        ? 'Вы исчерпали квоту бесплатных запросов или отправляете слишком много запросов в минуту (RESOURCE_EXHAUSTED).' 
        : lang === 'by' 
        ? 'Вы выдаткавалі квоту бясплатных запытаў ці адпраўляеце занадта шмат запытаў у хвіліну (RESOURCE_EXHAUSTED).' 
        : '大模型并发请求限制已触达（RESOURCE_EXHAUSTED）。免费级密钥在一分钟内发送了过多句子。',
      solution: lang === 'ru'
        ? 'Пожалуйста, подождите 60 секунд перед отправкой следующего фрагмента. Для пакетных исследований рекомендуется сделать паузу или воспользоваться нашими offline-шаблонами промптов во внешних интерфейсах.'
        : lang === 'by'
        ? 'Калі ласка, пачакайце 60 секунд перад адпраўкай наступнага фрагмента. Для вялікіх даследаванняў рэкамендуецца зрабіць паўзу ці скарыстацца нашымі афлайн-шаблонамі промптаў у знешніх інтэрфейсах.'
        : '请等待 60 秒以上的冷却时间再发送新的分析指令。如果您的口述史料庞大，建议点击其下方的本地离线处理按钮，或按步骤部署专有的离线模型。'
    };
  }

  // 4. Content Blocked / Safety
  if (errMsg.includes('safety') || errMsg.includes('blocked') || errMsg.includes('harm') || errMsg.includes('hate') || errMsg.includes('harassment')) {
    return {
      code: 'CONTENT_BLOCKED',
      title: lang === 'ru' ? 'Блокировка фильтра безопасности' : lang === 'by' ? 'Блакіроўка фільтра бяспекі' : '安全过滤拦截',
      reason: lang === 'ru'
        ? 'Запрос заблокирован фильтрами безопасности Gemini ввиду обнаружения деликатных или спорных слов в транскрипте.'
        : lang === 'by'
        ? 'Запыт заблакіраваны фільтрамі бяспекі Gemini з-за выяўлення адчувальных або спрэчных слоў у тэксце.'
        : '因受访文本中极个别方言词汇被境外安全过滤器判定为敏感，该分析遭主动截断。',
      solution: lang === 'ru'
        ? 'Пожалуйста, отредактируйте текст перед отправкой (удалите грубые диалектизмы или политические термины) либо переключитесь на локальный ручной разбор.'
        : lang === 'by'
        ? 'Калі ласка, адрэдагуйце тэкст перад адпраўкай або пераключыцеся на лакальны ручны разбор.'
        : '请略微精简、脱敏您的问题或采访内容再尝试分析，由此可避免被过滤策略拦截。'
    };
  }

  // Default Fallback
  return {
    code: errCode || 'GEMINI_GENERIC_ERROR',
    title: lang === 'ru' ? 'Ошибка API / Подключения' : lang === 'by' ? 'Памылка API / Падключэння' : 'API 交互或网络传输异常',
    reason: lang === 'ru'
      ? `Произошла неизвестная ошибка при обмене данными с Gemini API. Текст ошибки: ${errorObj?.message || errorObj}`
      : lang === 'by'
      ? `Адбылася невядомая памылка пры абмене данымі з Gemini API. Тэкст памылкі: ${errorObj?.message || errorObj}`
      : `向远程分析服务器推送请求时发生网络断开、超时或内容畸变。明细: ${errorObj?.message || errorObj}`,
    solution: lang === 'ru'
      ? 'Убедитесь в наличии стабильного интернет-соединения. Попробуйте обновить страницу или отправить более короткий фрагмент текста.'
      : lang === 'by'
      ? 'Упэўніцеся ў наяўнасці стабільнага інтэрнэт-злучэння. Паспрабуйце абнавіць старонку ці даслаць меншы кавалак тэксту.'
      : '请检查您的全球互联网接入条件。若网络正常，请尝试缩减单次发送的文本内容并再次调用。'
  };
}
