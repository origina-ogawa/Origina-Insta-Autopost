// Chatwork通知。scripts/publish-instagram.mjsのnotifyChatwork()と同じ実装だが、
// 設計書の決定によりpublish-instagram.mjsは変更しないため、ここに複製する
// (fetchを差し替え可能にしてテストできるようにした点のみ差分)。
export async function notifyChatwork(message, { token = process.env.CHATWORK_API_TOKEN, roomId = process.env.CHATWORK_ROOM_ID, fetchImpl = fetch } = {}) {
  if (!token || !roomId) return;
  await fetchImpl(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ body: message }),
  }).catch((e) => console.warn('Chatwork通知に失敗:', e.message));
}
