const Discord = require('discord.js')
const cron = require('cron')
const ytdl = require('ytdl-core')
const { GoogleSpreadsheet } = require('google-spreadsheet')

require('dotenv').config()

let max_rows = 50
let SHAPACSWEARWORDS = []
let JBSVIDEOS = []
let jotime_link = ''
let sheet_enabled = false
let discord_enabled = false

let fsp_enabled = false
let lowerbound = 0
let upperbound = 1000
let kickDelay = null

const client = new Discord.Client()
const YouTube = require('youtube-sr').default
const PREFIX = '🥚' // Added space to facilitate Discord autocomplete
let kick_X = '450287369766305822' // This is by default Shapac. edit D8 to change it's value.
let prev_no = -10
let muteMap = new Map()

client.on('ready', () => {
	console.log('I am ready!')
	discord_enabled = true
})

function getNumber() {
	let min = 0
	let max = JBSVIDEOS.length
	let i = Math.floor(Math.random() * (max - min)) + min
	if (prev_no === i) {
		i = getNumber()
	}
	prev_no = i
	return i
}

// let scheduledMessage = new cron.CronJob('0 */6 * * *', () => {
//     let channel = client.channels.cache.get('404664933452873732');
//     channel.send(SHAPACSWEARWORDS[Math.floor(Math.random() * SHAPACSWEARWORDS.length)]);
// });
// scheduledMessage.start()

function genRandomDC() {
	return lowerbound + Math.floor(Math.random() * (upperbound - lowerbound))
}

client.on('message', async (msg) => {
	let args = msg.content.substring(PREFIX.length).split(' ')

	if (msg.author.equals(client.user)) return
	if (msg.content.startsWith(PREFIX)) {
		switch (args[0].toLowerCase()) {
			case 'mute':
				let mute_duration = 300000
				const muted_user = msg.mentions.users.first()
				const muted_role = msg.guild.roles.cache.find((r) => r.name === 'Muted')

				if (!muted_user) return msg.channel.send('you need to mention somebody!!')
				if (!muted_role)
					return msg.channel.send(
						'No Role was found, please make sure you have a muted role.'
					)

				if (
					muteMap.has(muted_user.id) &&
					new Date().getTime() - muteMap.get(muted_user.id) < 14400000
				) {
					msg.channel.send(
						'User has been muted in the past 4 hours skipping....'
					)
					return
				}

				const voting = new Discord.MessageEmbed()
					.setColor('#42b34d')
					.setFooter('Mute ' + muted_user.tag + ' for 5m?')
					.setImage(muted_user.avatarURL)

				const agree = '✅'
				const disagree = '❌'
				const sentEmbed = await msg.channel.send(voting)
				await sentEmbed.react(agree)
				await sentEmbed.react(disagree)

				const voteStatus = await msg.channel.send(
					'Voting started 30 seconds left'
				)

				const filter = (reaction, user) =>
					(reaction.emoji.name === agree || reaction.emoji.name === disagree) &&
					!user.bot
				const collected = await sentEmbed.awaitReactions(filter, {
					time: 30000,
				})

				const agreed = collected.get(agree) || { count: 1 }
				const disagreed = collected.get(disagree) || { count: 1 }
				const agreed_count = agreed.count
				const disagreed_count = disagreed.count

				voteStatus.edit(
					'Voting ended with: ' +
						agreed_count +
						' ' +
						agree +
						' and ' +
						disagreed_count +
						' ' +
						disagree +
						'.'
				)

				if (agreed.count <= disagreed.count) {
					msg.channel.send('Mute Voting Failed 🥚')
					return
				}

				await msg.guild.member(muted_user).roles.add(muted_role)
				muteMap.set(muted_user.id, new Date().getTime())

				if (msg.guild.member(muted_user).voice.channel)
					await msg.guild.member(muted_user).voice.setMute(true)

				if (muted_user.id === kick_X) mute_duration *= 3
				setTimeout(function () {
					console.log('Unmuting ' + muted_user + '.')
					if (msg.guild.member(muted_user).voice.channel) {
						msg.guild.member(muted_user).voice.setMute(false)
					}
					msg.guild.member(muted_user).roles.remove(muted_role)
				}, mute_duration)

				break

			case 'jotime':
				msg.reply(jotime_link)
				break

			case 'leave':
				if (!msg.member.voice.channel) {
					msg.reply('You are not in a voice channel!')
					return
				}

				msg.member.voice.channel.leave()
				break

			case 'play':
				if (!msg.member.voice.channel) {
					msg.reply('You have to be in a voice channel!')
					return
				}

				const cur_channel = msg.member.voice.channel
				let url = msg.content.replace('🥚play ', '')

				var pattern = /^((http|https|ftp):\/\/)/
				if (!pattern.test(url)) {
					const videos = await YouTube.search(url, {
						type: 'video',
					}).catch()

					if (!videos) {
						msg.reply(`No videos found for "${url}"`)
						throw new Error(`No videos found for "${url}"`)
					}

					url = 'https://youtube.com/watch?v=' + videos[0].id
					console.log(url)
				}

				let connection = await cur_channel.join()
				try {
					let stream = /** await **/ ytdl(url, {
						filter: 'audioonly',
					})
						.on('info', (info) => {
							msg.reply(
								`Playing: ${info.player_response.videoDetails.title}`
							)
							msg.delete({ timeout: 2000 })
						})
						.on('error', (err) => {
							// Duplicate error handling her cause asynchronous and i don't feel like dealing with it.
							msg.reply('no video found')
							msg.delete({ timeout: 2000 })
							cur_channel.leave()
						})

					let dispatcher = await connection.play(stream)
					dispatcher.on('error', (err) => {
						throw err
					})
					dispatcher.on('finish', (_end) => {
						cur_channel.leave()
					})
				} catch (error) {
					await msg.reply('no video found')
					await msg.delete({ timeout: 2000 })
					// cur_channel.leave();
				}

				break
			case 'pause':
				if (!msg.member.voice.channel) {
					msg.reply('You have to be in a voice channel!')
					return
				}

				cur_channel = msg.member.voice.channel
				let connection = await cur_channel.join()
				let dispatcher = await connection.play(
					ytdl(msg.content.replace('🥚play ', ''), { filter: 'audioonly' })
				)
				await cur_channel.leave()

				break
		}
	} else if (msg.content.startsWith('<:JamesPog:')) {
		if (!msg.member.voice.channel) msg.reply('You have to be in a voice channel!')

		cur_channel = msg.member.voice.channel
		let connection = await cur_channel.join()
		let dispatcher = await connection.play(
			ytdl(JBSVIDEOS[getNumber()], { filter: 'audioonly' })
		)
		dispatcher.on('finish', (_end) => {
			setTimeout(() => {
				cur_channel.leave()
			}, 500)
		})

		msg.delete({ timeout: 5000 })
	}
})

client.on('voiceStateUpdate', (oldState, newState) => {
	if (fsp_enabled && sheet_enabled) {
		let newChannel = newState.channel
		let oldChannel = oldState.channel

		async function vcKick() {
			await newState.member.voice.kick()
			client.channels.cache
				.get('820219287938793523')
				.messages.fetch('820231421465591829')
				.then((message) =>
					message.edit(
						'>>> 🤡 has been **kicked**🎉🎉🎉🎉 - Courtesy of <@91974715383488512>\n' +
							Date().toLocaleString('en-GB', { timeZone: 'Europe/Malta' })
					)
				)
		}
		if (!oldChannel && newChannel && newState.member.id === kick_X) {
			let randomDC = genRandomDC() * 1000
			kickDelay = setTimeout(() => {
				vcKick()
			}, randomDC)
		} else if (oldChannel && !newChannel && newState.member.id == kick_X) {
			clearTimeout(kickDelay)
		}
	}
})

// THIS  MUST  BE  THIS  WAY
console.log('Logging in...')
client.login(process.env.BOT_TOKEN) //BOT_TOKEN is the Client Secret

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID)

async function accessSpreadsheet() {
	await doc.useServiceAccountAuth({
		client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		private_key: process.env.GOOGLE_PRIVATE_KEY,
	})
	await doc.loadInfo() // loads document properties and worksheets

	const sheet = doc.sheetsByIndex[0]

	let list_shapac_quotes = []
	let list_jbs_videos = []

	await sheet.loadCells('A1:D' + parseInt(max_rows)).then(function () {
		for (let i = 1; i < max_rows; i++) {
			if (sheet.getCell(i, 0).value != null)
				list_shapac_quotes.push(sheet.getCell(i, 0).value)
		}
		for (let i = 1; i < max_rows; i++) {
			if (sheet.getCell(i, 1).value != null)
				list_jbs_videos.push(sheet.getCell(i, 1).value)
		}

		SHAPACSWEARWORDS = list_shapac_quotes
		JBSVIDEOS = list_jbs_videos

		fsp_enabled = sheet.getCell(1, 3).value
		lowerbound = sheet.getCell(2, 3).value
		upperbound = sheet.getCell(3, 3).value
		jotime_link = sheet.getCellByA1('D7').value
		kick_X = parseInt(sheet.getCellByA1('D8').value)
	})

	sheet_enabled = true

	// const D50 = sheet.getCellByA1('D50');
	// D50.value = Date().toLocaleString('en-GB', { timeZone: 'Europe/Malta' });
	// await sheet.saveUpdatedCells();

	const exampleEmbed = new Discord.MessageEmbed()
		.setColor('#0099ff')
		.setTitle('FSP?')
		.setAuthor('One Jbs Boi')
		.setThumbnail(sheet.getCellByA1('D6').value)
		.setDescription('Is Shapac sad right now?')
		.addFields(
			{ name: 'sad?', value: fsp_enabled ? 'yes 😎😈😎' : 'no 😭😭😭' },
			{
				name: 'lower bound:',
				value: parseInt(lowerbound / 60) + 'min',
				inline: true,
			},
			{
				name: 'upper bound:',
				value: parseInt(upperbound / 60) + 'min',
				inline: true,
			}
		)
		.setImage(sheet.getCellByA1('D5').value)
		.setTimestamp()
		.setFooter('FSP 😎😎😎😎😎', sheet.getCellByA1('D5').value)

	if (discord_enabled) {
		client.channels.cache
			.get('820219287938793523')
			.messages.fetch('820223123672137740')
			.then((message) => message.edit(exampleEmbed))
	}
}

accessSpreadsheet().then(function () {
	console.log('DB connected.')
})
setInterval(accessSpreadsheet, 60000)
