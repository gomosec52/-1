import { packNumber } from './config';
import { supabaseAdmin } from './supabaseAdmin';

export async function getGamesForPack(packValue) {
  const db = supabaseAdmin();
  const pack = packNumber(packValue);
  const { data: games, error } = await db
    .from('games')
    .select('*')
    .eq('pack', pack)
    .order('id', { ascending: false });

  if (error) throw error;
  if (!games?.length) return [];

  const ids = games.map((game) => game.id);
  const [{ data: reactions }, { data: votes }] = await Promise.all([
    db.from('reactions').select('game_id, value').in('game_id', ids),
    db.from('votes').select('game_id, choice, user_id').in('game_id', ids)
  ]);

  const voteUserIds = [...new Set((votes || []).map((vote) => vote.user_id))];
  let usersById = new Map();
  if (voteUserIds.length) {
    const { data: users } = await db
      .from('app_users')
      .select('id, username')
      .in('id', voteUserIds);
    usersById = new Map((users || []).map((user) => [user.id, user.username]));
  }

  return games.map((game) => {
    const gameReactions = (reactions || []).filter((reaction) => reaction.game_id === game.id);
    const gameVotes = (votes || [])
      .filter((vote) => vote.game_id === game.id)
      .map((vote) => ({
        choice: vote.choice,
        username: usersById.get(vote.user_id) || 'unknown'
      }));

    return {
      ...game,
      likes: gameReactions.filter((reaction) => reaction.value === 1).length,
      dislikes: gameReactions.filter((reaction) => reaction.value === -1).length,
      votes: gameVotes
    };
  });
}

export async function getChatMessages() {
  const db = supabaseAdmin();
  const { data: messages, error } = await db
    .from('chat_messages')
    .select('id, user_id, message, created_at')
    .order('id', { ascending: false })
    .limit(50);

  if (error) throw error;
  const rows = (messages || []).reverse();
  const userIds = [...new Set(rows.map((message) => message.user_id))];
  let usersById = new Map();

  if (userIds.length) {
    const { data: users } = await db
      .from('app_users')
      .select('id, username')
      .in('id', userIds);
    usersById = new Map((users || []).map((user) => [user.id, user.username]));
  }

  return rows.map((message) => ({
    id: message.id,
    username: usersById.get(message.user_id) || 'unknown',
    message: message.message,
    created_at: message.created_at
  }));
}
