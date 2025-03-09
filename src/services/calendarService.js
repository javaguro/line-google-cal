const { google } = require('googleapis');
const { getTokens } = require('./firestoreService');

let lastCreatedEvent = null;

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
        const createdEvent = await createEvent(calendar, request);
        lastCreatedEvent = {
          id: createdEvent.id,
          summary: createdEvent.summary,
          date: request.date,
          time: request.time
        };
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

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventData,
    conferenceDataVersion: request.link === 'Google Meet' ? 1 : 0,
    sendUpdates: request.attendees ? 'all' : 'none'
  });

  return response.data;
}

async function updateEvent(calendar, request) {
  // 指定された日付の予定を検索（時間の前後1日も含める）
  const searchDate = parseDateTime(request.date, '00:00');
  const nextDay = new Date(searchDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: searchDate.toISOString(),
    timeMax: nextDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  if (!events.data.items || events.data.items.length === 0) {
    throw new Error('指定された日付の予定が見つかりませんでした');
  }

  // 直前に作成または更新した予定があれば、それを優先的に更新
  let targetEvent = null;
  if (lastCreatedEvent && lastCreatedEvent.date === request.date) {
    targetEvent = events.data.items.find(event => event.id === lastCreatedEvent.id);
  }

  // 直前の予定が見つからない場合は、時間とタイトルで検索
  if (!targetEvent) {
    for (const event of events.data.items) {
      const eventStart = new Date(event.start.dateTime);
      const requestedTime = request.time ? parseDateTime(request.date, request.time) : null;
      
      if (requestedTime && eventStart.getHours() === requestedTime.getHours() && 
          eventStart.getMinutes() === requestedTime.getMinutes()) {
        targetEvent = event;
        break;
      }
      
      if (!requestedTime && event.summary && (
        event.summary.includes('打ち合わせ') ||
        event.summary.includes('ミーティング') ||
        event.summary.includes(request.eventName)
      )) {
        targetEvent = event;
        break;
      }
    }
  }

  if (!targetEvent) {
    throw new Error('指定された予定が見つかりませんでした');
  }

  const newStartDateTime = request.time ? parseDateTime(request.date, request.time) : new Date(targetEvent.start.dateTime);
  const newEndDateTime = new Date(newStartDateTime);
  const durationInMinutes = request.duration || Math.floor((new Date(targetEvent.end.dateTime) - new Date(targetEvent.start.dateTime)) / (1000 * 60));
  newEndDateTime.setMinutes(newEndDateTime.getMinutes() + durationInMinutes);

  const eventData = {
    summary: request.eventName || targetEvent.summary,
    start: {
      dateTime: newStartDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    },
    end: {
      dateTime: newEndDateTime.toISOString(),
      timeZone: 'Asia/Tokyo'
    }
  };

  // 既存の設定を保持
  if (targetEvent.location && !request.location) {
    eventData.location = targetEvent.location;
  } else if (request.location) {
    eventData.location = request.location;
  }

  if (targetEvent.attendees && !request.attendees) {
    eventData.attendees = targetEvent.attendees;
  } else if (request.attendees) {
    eventData.attendees = request.attendees.map(email => ({ email }));
  }

  if (targetEvent.conferenceData && !request.link) {
    eventData.conferenceData = targetEvent.conferenceData;
  } else if (request.link === 'Google Meet' && !targetEvent.conferenceData) {
    eventData.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: targetEvent.id,
    requestBody: eventData,
    conferenceDataVersion: request.link === 'Google Meet' ? 1 : 0,
    sendUpdates: request.attendees ? 'all' : 'none'
  });

  // 更新した予定を記録
  lastCreatedEvent = {
    id: response.data.id,
    summary: response.data.summary,
    date: request.date,
    time: request.time || targetEvent.start.dateTime
  };
}

async function deleteEvent(calendar, request) {
  // 削除処理の実装
}

module.exports = { handleCalendarOperation };