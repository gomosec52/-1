const DISCORD_FIELD_LIMIT = 1024;

function trimDiscordText(value, max = 1024) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function sendDiscordWebhook(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

export async function notifyDiscordGameAdded({ game, admin }) {
  await sendDiscordWebhook({
    username: 'Anime Game Packs',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds: [
      {
        title: '🎮 Новая игра добавлена',
        color: 0xff62c8,
        description: `**${trimDiscordText(game.title, 180)}**`,
        fields: [
          { name: 'Пак', value: `Пак игр ${game.pack}`, inline: true },
          { name: 'Добавил', value: trimDiscordText(admin?.username || 'Админ', 120), inline: true },
          { name: 'Жанр', value: trimDiscordText(game.genre || 'Не указан', 120), inline: true },
          { name: 'Вес', value: trimDiscordText(game.size || 'Не указан', 120), inline: true },
          { name: 'Мультиплеер', value: trimDiscordText(game.multiplayer || 'Не указан', 120), inline: true },
          {
            name: 'Описание',
            value: trimDiscordText(game.description || 'Описание пока не добавлено.', DISCORD_FIELD_LIMIT)
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });
}

export async function notifyDiscordGameVote({ game, user, choice }) {
  const isYes = choice === 'yes';
  await sendDiscordWebhook({
    username: 'Anime Game Packs',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds: [
      {
        title: '🗳 Новый голос',
        color: isYes ? 0x00d4ff : 0xff62c8,
        description: [
          `**Игрок:** ${trimDiscordText(user?.username || 'Игрок', 120)}`,
          `**Игра:** ${trimDiscordText(game.title, 180)}`,
          `**Голос:** ${isYes ? 'играем' : 'не играем'}`
        ].join('\n'),
        fields: [
          { name: 'Пак', value: `Пак игр ${game.pack}`, inline: true },
          { name: 'Жанр', value: trimDiscordText(game.genre || 'Не указан', 120), inline: true }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });
}
