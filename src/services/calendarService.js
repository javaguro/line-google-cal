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
  
  // durationは分単位で指定されているので、それを反映
  const durationInMinutes = request.duration || 60; // デフォルトは60分
  endDateTime.setMinutes(endDateTime.getMinutes() + durationInMinutes);

  const eventData = {
    summary: request.eventName,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    }
  };

  // 場所が指定されている場合
  if (request.location) {
    eventData.location = request.location;
  }

  // ゲストが指定されている場合
  if (request.attendees && request.attendees.length > 0) {
    eventData.attendees = request.attendees.map(email => ({ email }));
  }

  // Google Meetリンクが要求されている場合
  if (request.link === 'Google Meet') {
    eventData.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventData,
    conferenceDataVersion: request.link === 'Google Meet' ? 1 : 0,
    sendUpdates: request.attendees ? 'all' : 'none'
  });
}

async function updateEvent(calendar, request) {
  // まず、指定された日時の予定を検索
  const startDateTime = parseDateTime(request.date, request.time);
  const endDateTime = new Date(startDateTime);
  endDateTime.setHours(endDateTime.getHours() + 1); // 検索用に1時間後まで

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDateTime.toISOString(),
    timeMax: endDateTime.toISOString(),
    q: request.eventName, // イベント名で検索
    singleEvents: true,
    orderBy: 'startTime'
  });

  if (!events.data.items || events.data.items.length === 0) {
    throw new Error('指定された予定が見つかりませんでした');
  }

  // 最も近い予定を更新
  const event = events.data.items[0];
  const newStartDateTime = parseDateTime(request.date, request.time);
  const newEndDateTime = new Date(newStartDateTime);
  const durationInMinutes = request.duration || 60;
  newEndDateTime.setMinutes(newEndDateTime.getMinutes() + durationInMinutes);

  const eventData = {
    summary: request.eventName,
    start: {
      dateTime: newStartDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    },
    end: {
      dateTime: newEndDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    }
  };

  // 場所が指定されている場合
  if (request.location) {
    eventData.location = request.location;
  }

  // ゲストが指定されている場合
  if (request.attendees && request.attendees.length > 0) {
    eventData.attendees = request.attendees.map(email => ({ email }));
  }

  // Google Meetリンクが要求されている場合
  if (request.link === 'Google Meet' && !event.conferenceData) {
    eventData.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  await calendar.events.update({
    calendarId: 'primary',
    eventId: event.id,
    requestBody: eventData,
    conferenceDataVersion: request.link === 'Google Meet' ? 1 : 0,
    sendUpdates: request.attendees ? 'all' : 'none'
  });
}

async function deleteEvent(calendar, request) {
  // 削除処理の実装
}

module.exports = { handleCalendarOperation };