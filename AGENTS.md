# Antigravity Rules for WhatsApp Self-Bot

## Repository Information
- Workspace: `/root/self-bot`
- Framework: Node.js with `@whiskeysockets/baileys`
- Process Manager: PM2 (`self-bot`)
- Plugin Directory: `./perintah/` (watched by `lib/pluginManager.js`)

## Rules for Adding & Modifying Bot Features / Plugins
1. **Always Create Files in `./perintah/`**:
   - Whenever asked to add, create, or update a feature or command, YOU MUST ACTUALLY WRITE OR EDIT the file in `./perintah/<nama_plugin>.js` using `write_to_file` or `replace_file_content`.
   - NEVER simply show code snippets in markdown chat without writing the file.
   - Do NOT create files in `scratch/` or `/tmp/`.

2. **No Interactive Prompt Tools**:
   - DO NOT call `ask_question` because the agent runs headlessly via WhatsApp. Make reasonable defaults or implement sensible command aliases.

3. **Standard Plugin Structure**:
   Every plugin file in `./perintah/` must follow this structure:
   ```javascript
   module.exports = {
       CmD: ['command1', 'command2'], // Array of primary commands
       aliases: ['command1', 'command2', 'alias1'], // Array of all aliases
       categori: 'category_name', // e.g. 'group', 'tools', 'maker', 'owner', 'game'
       exec: async (m, { bob, args, text, prefix, command, isCreator, isOwner, quoted, qmsg, budy }) => {
           // Command implementation
       }
   };
   ```

4. **Group Features Rules**:
   - Verify group status: `if (!m.isGroup) return m.reply('Perintah ini hanya dapat digunakan di dalam grup!');`
   - Retrieve group metadata and admin list:
     ```javascript
     const groupMetadata = await bob.groupMetadata(m.chat);
     const participants = groupMetadata.participants || [];
     const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
     const botNumber = bob.decodeJid(bob.user.id);
     const isBotAdmin = admins.includes(botNumber);
     const isAdmin = admins.includes(m.sender) || isCreator || isOwner;
     ```
   - Target user extraction order:
     1. Quoted sender: `m.quoted && m.quoted.sender`
     2. Mentioned JID: `m.mentionedJid && m.mentionedJid[0]`
     3. Number text: `text.replace(/[^0-9]/g, '') + '@s.whatsapp.net'`
   - Baileys group administration actions:
     - `bob.groupParticipantsUpdate(m.chat, [targetJid], 'add')`
     - `bob.groupParticipantsUpdate(m.chat, [targetJid], 'remove')`
     - `bob.groupParticipantsUpdate(m.chat, [targetJid], 'promote')`
     - `bob.groupParticipantsUpdate(m.chat, [targetJid], 'demote')`
     - `bob.groupSettingUpdate(m.chat, 'announcement')` (mute group)
     - `bob.groupSettingUpdate(m.chat, 'not_announcement')` (unmute group)
     - `bob.groupUpdateSubject(m.chat, newName)` (rename group)

5. **Style Guidelines**:
   - Clean, professional text output (no emoji spam).
   - Responses should be concise, helpful, and in Indonesian.
