const line = require('@line/bot-sdk');
const { analyzeMessage } = require('../services/openaiService');
const { handleCalendarOperation } = require('../services/calendarService');
const { getAuthUrl } = require('../services/authService');
const { getTokens } = require('../services/firestoreService');

const lineClient = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

async function handleLineWebhook(req, res) {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') {
        continue;
      }

      const userId = event.source.userId;
      const text = event.message.text;

      console.log('受信メッセージ:', text);
      console.log('ユーザーID:', userId);

      try {
        // まず、メッセージを解析
        const parsedRequest = await analyzeMessage(text);
        console.log('解析結果:', parsedRequest);

        if (!parsedRequest.date || !parsedRequest.time || !parsedRequest.eventName) {
          throw new Error('予定の詳細が不足しています');
        }

        // 認証状態をチェック
        const tokens = await getTokens(userId);
        
        if (!tokens) {
          // 未認証の場合、認証URLを送信
          const authUrl = await getAuthUrl(userId);
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: `予定を登録するには、Googleカレンダーとの連携が必要です。\n以下のURLをクリックして連携を行ってください：\n${authUrl}`
          });
          continue;
        }

        // 認証済みの場合、カレンダー操作を実行
        const result = await handleCalendarOperation(userId, parsedRequest);
        
        const actionText = {
          create: '登録',
          update: '更新',
          delete: '削除'
        }[parsedRequest.action];

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: result.success 
            ? `✅ 「${parsedRequest.eventName}」を${parsedRequest.date} ${parsedRequest.time}からGoogleカレンダーに${actionText}しました！`
            : `❌ 予定の${actionText}に失敗しました。\n${result.error || '時間を置いて再度お試しください。'}`
        });
      } catch (error) {
        console.error('予定処理エラー:', error);
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `申し訳ありません。予定の処理中にエラーが発生しました。\n例：「明日の15時から2時間、打ち合わせ」のように入力してください。`
        });
      }
    }
    res.status(200).end();
  } catch (error) {
    console.error('Webhookエラー:', error);
    res.status(500).end();
  }
}

module.exports = {
  handleLineWebhook
};