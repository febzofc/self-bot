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

2. **Approval, Autonomy & Code Choice Policy**:
   - **Auto-Allowed Non-Fatal Operations**:
     - Terminal commands that are non-destructive (e.g. `curl`, `wget`, `cat`, `ls`, `grep`, `node`, `npm test`, `git status/diff/add/commit`) are executed automatically without user approval.
     - Plugin creation and editing inside `./perintah/` (and routine helper files) are auto-allowed.
   - **Fatal / Critical Operations (Manual Approval Required)**:
     - System/repository destructive actions (`rm -rf`, `rmdir`, `git reset --hard`, deleting WhatsApp `session/`, reboot/shutdown, chmod root, and PM2 manipulation `pm2 restart/stop`) will trigger a risk warning and require Owner approval (`Y` / `N`).
     - Modifying critical core bot files (`main.js`, `control.js`, `config.js`, `ecosystem.config.js`) will require manual approval.
   - **Code Recommendations & Choices**:
     - When multiple implementation options, architectural trade-offs, or code recommendations exist ("rekomendasi kode / pilihan kode"), present clear and concise choices directly in the chat so the user can decide.
   - DO NOT call GUI modal `ask_question` because the agent runs headlessly via WhatsApp; present options directly in the conversation text.

3. **PM2 Restart & Code Execution Policy**:
   - **No PM2 Restart for Plugin/Command Changes**:
     - The `./perintah/` directory is automatically watched and hot-reloaded in memory by `lib/pluginManager.js` (`fs.watch`).
     - If ONLY adding, creating, or editing plugins/commands in `./perintah/`, **DO NOT restart PM2** (`pm2 restart self-bot`). It is completely unnecessary and causes disconnection.
   - **NEVER Restart PM2 Unilaterally**:
     - The WhatsApp bot itself runs as the PM2 process `self-bot`. Executing `pm2 restart self-bot` or any PM2 stop/restart command immediately kills the bot host, disconnects the WhatsApp socket, and aborts the ongoing task.
     - NEVER execute `pm2 restart self-bot` unilaterally. All PM2 manipulation commands are strictly classified as FATAL and will be blocked by gatekeeper hooks unless explicitly approved (`Y` / `N`) by the Owner.
     - If changes were made to `lib/` or dependencies, instruct the Owner in the final chat message to perform a manual restart if required.

4. **Standard Plugin Structure**:
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

5. **Group Features Rules**:
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

6. **Style Guidelines**:
   - Clean, professional text output (no emoji spam).
   - Responses should be concise, helpful, and in Indonesian.
