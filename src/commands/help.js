module.exports = {
    name: 'menu',
    aliases: ['help', 'commands'],
    description: 'Menampilkan daftar perintah.',

    async execute({ reply, commandHandler, isAdmin }) {
        const commands = commandHandler
            .getCommands()
            .filter(cmd => !cmd.hidden)
            .filter(cmd => !cmd.adminOnly || isAdmin)
            .filter((cmd, index, arr) =>
                arr.findIndex(item => item.name === cmd.name) === index
            );

        const list = commands
            .map(cmd =>
`• *!${cmd.name}*
> ${cmd.description || 'Tidak ada deskripsi.'}`)
            .join('\n\n');

        const text = `
╭─────────────────────╮
│ 🤖 *BASIC BOT WA* 🤖 │
╰─────────────────────╯

Selamat datang 👋

Berikut daftar command yang tersedia.

${list}

━━━━━━━━━━━━━━━━━━━━

📌 *Informasi*
> Prefix : *!* *.* */*
> Total Command : *${commands.length}*
> Status : 🟢 Online

━━━━━━━━━━━━━━━━━━━━
© Basic Bot WhatsApp
`.trim();

        await reply({ text });

        return true;
    },
};
