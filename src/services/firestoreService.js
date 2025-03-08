const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Firebase Admin SDKの初期化
const serviceAccount = require(path.join(__dirname, '../config/firebase-admin-key.json'));
initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore();

async function saveTokens(userId, tokens) {
  try {
    if (!userId) {
      throw new Error('ユーザーIDが指定されていません');
    }
    await firestore.collection('users').doc(userId).set({
      tokens,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Firestore save error:', error);
    throw new Error('トークンの保存に失敗しました');
  }
}

async function getTokens(userId) {
  try {
    if (!userId) {
      throw new Error('ユーザーIDが指定されていません');
    }
    const doc = await firestore.collection('users').doc(userId).get();
    return doc.exists ? doc.data().tokens : null;
  } catch (error) {
    console.error('Firestore get error:', error);
    throw new Error('トークンの取得に失敗しました');
  }
}

module.exports = { saveTokens, getTokens };