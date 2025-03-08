const { OAuth2Client } = require('google-auth-library');
const { saveTokens } = require('../services/firestoreService');

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

async function handleGoogleCallback(req, res) {
  try {
    const { code, state } = req.query;
    const userId = state; // state contains LINE userId

    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(userId, tokens);

    res.send('認証が完了しました。LINEに戻って予定の登録を試してみてください！');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('認証に失敗しました。もう一度お試しください。');
  }
}

module.exports = { handleGoogleCallback };