const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let lastMessage = null;
let lastAnalysis = null;

async function analyzeMessage(text) {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const systemContent = `あなたはカレンダーアシスタントです。
現在の日付は${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日です。
自然言語の予定リクエストを解析して、以下のJSON形式に変換してください：

{
  "action": "create" | "update" | "delete",
  "date": "YYYY-MM-DD形式の日付（今日の日付を基準に計算）",
  "time": "HH:mm形式の時刻",
  "duration": "分単位の数値（デフォルト60）",
  "eventName": "イベント名",
  "location": "場所の名前（指定がある場合）",
  "attendees": ["メールアドレス1", "メールアドレス2"]（指定がある場合）,
  "link": "Google Meet"（オンラインミーティングの指定がある場合）
}

直前のメッセージと解析結果が提供された場合は、それらを考慮して解析してください。
特に、予定の更新や変更の場合は、直前の予定の情報を引き継いでください。

例1：
直前のメッセージ: "明日の20時に打ち合わせを設定して。場所は渋谷"
直前の解析結果: {
  "action": "create",
  "date": "2025-03-10",
  "time": "20:00",
  "duration": 60,
  "eventName": "打ち合わせ",
  "location": "渋谷"
}
入力: "打ち合わせではなく、ミーティングにタイトルを変更して"
出力: {
  "action": "update",
  "date": "2025-03-10",
  "time": "20:00",
  "duration": 60,
  "eventName": "ミーティング",
  "location": "渋谷"
}

「明日」は${tomorrow.getFullYear()}年${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日を指します。
「来週」は7日後を指します。
「今日」は${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日を指します。`;

    const messages = [
      {
        role: "system",
        content: systemContent
      }
    ];

    // 直前のメッセージと解析結果がある場合は、それらを含める
    if (lastMessage && lastAnalysis) {
      messages.push({
        role: "user",
        content: `直前のメッセージ: "${lastMessage}"\n直前の解析結果: ${JSON.stringify(lastAnalysis, null, 2)}`
      });
    }

    messages.push({
      role: "user",
      content: text
    });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content);
    console.log('OpenAI解析結果:', parsedResponse);

    // 現在のメッセージと解析結果を保存
    lastMessage = text;
    lastAnalysis = parsedResponse;

    return parsedResponse;
  } catch (error) {
    console.error('OpenAI APIエラー:', error);
    throw new Error('申し訳ありませんが、予定の解析に失敗しました。もう一度お試しください。');
  }
}

module.exports = {
  analyzeMessage
};