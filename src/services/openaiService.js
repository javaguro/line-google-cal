const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function analyzeMessage(text) {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `あなたはカレンダーアシスタントです。
現在の日付は${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日です。
自然言語の予定リクエストを解析して、以下のJSON形式に変換してください：

{
  "action": "create" | "update" | "delete",
  "date": "YYYY-MM-DD形式の日付（今日の日付を基準に計算）",
  "time": "HH:mm形式の時刻",
  "duration": "分単位の数値（デフォルト60）",
  "eventName": "イベント名"
}

例：
入力: "明日の15時から2時間、打ち合わせ"
出力: {
  "action": "create",
  "date": "${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}",
  "time": "15:00",
  "duration": 120,
  "eventName": "打ち合わせ"
}

「明日」は${tomorrow.getFullYear()}年${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日を指します。
「来週」は7日後を指します。
「今日」は${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日を指します。`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content);
    console.log('OpenAI解析結果:', parsedResponse);
    return parsedResponse;
  } catch (error) {
    console.error('OpenAI APIエラー:', error);
    throw new Error('申し訳ありませんが、予定の解析に失敗しました。もう一度お試しください。');
  }
}

module.exports = {
  analyzeMessage
};