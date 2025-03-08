const { google } = require('googleapis');
const { getTokens } = require('./firestoreService');

function parseDateTime(dateStr, timeStr) {
  const now = new Date();
  let date;

  if (dateStr === 'tomorrow') {
    date = new Date(now);
    date.setDate(date.getDate() + 1);
  } else {
    // その他の日付形式の処理（必要に応じて追加）
    date = new Date(dateStr);
  }

  const [hours, minutes] = timeStr.split(':');
  date.setHours(parseInt(hours, 10));
  date.setMinutes(parseInt(minutes, 10));
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
}

async function handleCalendarOperation(userId, request) {
  try {
    const tokens = await getTokens(userId);
    if (!tokens) {
      return {
        success: false,
        error: 'Googleカレンダーとの連携が必要です。"/auth"と送信して認証を行ってください。'
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: createAuthClient(tokens) });

    switch (request.action) {
      case 'create':
        await createEvent(calendar, request);
        return { success: true, action: '登録' };
      case 'update':
        await updateEvent(calendar, request);
        return { success: true, action: '更新' };
      case 'delete':
        await deleteEvent(calendar, request);
        return { success: true, action: '削除' };
      default:
        throw new Error('不正な操作です');
    }
  } catch (error) {
    console.error('Calendar operation error:', error);
    return {
      success: false,
      error: 'カレンダー操作に失敗しました: ' + error.message
    };
  }
}

function createAuthClient(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function createEvent(calendar, request) {
  const startDateTime = parseDateTime(request.date, request.time);
  const endDateTime = new Date(startDateTime);
  endDateTime.setHours(endDateTime.getHours() + 1); // デフォルトで1時間の予定

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: request.eventName,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Tokyo'
      }
    }
  });
}

async function updateEvent(calendar, request) {
  // 更新処理の実装
}

async function deleteEvent(calendar, request) {
  // 削除処理の実装
}

module.exports = { handleCalendarOperation };