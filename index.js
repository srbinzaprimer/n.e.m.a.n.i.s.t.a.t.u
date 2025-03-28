require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Complete Configuration
const CONFIG = {
  AFF_CODE: process.env.AFFILIATE_CODE || 'YOUR_AFF_CODE',
  ALLOWED_CHANNEL: process.env.ALLOWED_CHANNEL_ID || 'YOUR_CHANNEL_ID',
  SPAM_LIMIT: 3,
  SPAM_WINDOW: 15000,
  EMOJI_MAPPING: {
    taobao: '',
    weidian: '',
    '1688': '',
    kakobuy: '<:kb:1354527507180949615>',
    cnfans: '<:kb:1354527507180949615>',
    joyabuy: '<:kb:1354527507180949615>',
    pandabuy: '<:kb:1354527507180949615>',
    mulebuy: '<:kb:1354527507180949615>'
  },
  ALLOWED_DOMAINS: {
    taobao: /taobao\.com/i,
    weidian: /weidian\.com/i,
    '1688': /1688\.com/i,
    kakobuy: /kakobuy\.com/i,
    cnfans: /cnfans\.com/i,
    joyabuy: /joyabuy\.com/i,
    pandabuy: /pandabuy\.(com|page\.link|allapp\.link)/i,
    mulebuy: /mulebuy\.com/i
  },
  PLATFORM_MAP: {
    'ALI_1688': '1688',
    'WEIDIAN': 'weidian',
    'TAOBAO': 'taobao',
    'ali_1688': '1688',
    'weidian': 'weidian',
    'taobao': 'taobao'
  },
  SHORT_LINK_PROVIDERS: [
    'pandabuy.page.link',
    'pandabuy.allapp.link'
  ]
};

const userLinkCounts = new Map();

// Bot Ready Event
client.on('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} is fully operational!`);
  //console.log(`🛒 Supported platforms: Taobao, Weidian, 1688, CNFans, JoyaBuy, PandaBuy, MuleBuy`);
});

// Message Handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CONFIG.ALLOWED_CHANNEL) return;

  try {
    const userId = message.author.id;
    const allUrls = extractAllUrls(message.content);
    const { validLinks, invalidUrls } = await processUrls(allUrls);

    if (invalidUrls.length > 0) {
      await message.reply({
        content: '🚫 Nepodržan link. Podržane platforme: Taobao, Weidian, 1688, CnFans, JoyaBuy, PandaBuy, MuleBuy',
        allowedMentions: { repliedUser: false }
      });
      return;
    }

    if (validLinks.length > 0 && handleSpamDetection(userId, validLinks)) {
      await punishUser(message);
      return;
    }

    const { conversions, buttons } = generateLinks(validLinks);
    
    if (conversions.length > 0) {
      const actionRows = chunkArray(buttons, 5).map(chunk => 
        new ActionRowBuilder().addComponents(chunk)
      );

      await message.reply({
        content: [
          `${message.author}, uspešno smo konvertovali vaš link! Srećna kupovina!`
        ].join('\n'),
        components: actionRows,
        allowedMentions: { repliedUser: true }
      });
    }
  } catch (error) {
    console.error('❌ Greška:', error);
    await message.reply('❌ Došlo je do greške prilikom obrade linkova.').catch(console.error);
  }
});

// URL Processing Functions
async function processUrls(urls) {
  const validLinks = [];
  const invalidUrls = [];

  for (const url of urls) {
    let platform;
    const domainChecks = {
      kakobuy: CONFIG.ALLOWED_DOMAINS.kakobuy.test(url),
      cnfans: CONFIG.ALLOWED_DOMAINS.cnfans.test(url),
      joyabuy: CONFIG.ALLOWED_DOMAINS.joyabuy.test(url),
      pandabuy: CONFIG.ALLOWED_DOMAINS.pandabuy.test(url),
      mulebuy: CONFIG.ALLOWED_DOMAINS.mulebuy.test(url)
    };

    // Process Kakobuy links
    if (domainChecks.kakobuy) {
      const processed = processKakobuyLink(url);
      if (processed) validLinks.push(processed);
      else invalidUrls.push(url);
      continue;
    }
    
    // Process CNFans links
    if (domainChecks.cnfans) {
      const processed = processThirdPartyLink(url, 'cnfans');
      if (processed) validLinks.push(processed);
      else invalidUrls.push(url);
      continue;
    }

    // Process JoyaBuy links
    if (domainChecks.joyabuy) {
      const processed = processThirdPartyLink(url, 'joyabuy');
      if (processed) validLinks.push(processed);
      else invalidUrls.push(url);
      continue;
    }

    // Process PandaBuy links
    if (domainChecks.pandabuy) {
      const processed = await processPandabuyLink(url);
      if (processed) validLinks.push(processed);
      else invalidUrls.push(url);
      continue;
    }

    // Process MuleBuy links
    if (domainChecks.mulebuy) {
      const processed = processThirdPartyLink(url, 'mulebuy');
      if (processed) validLinks.push(processed);
      else invalidUrls.push(url);
      continue;
    }

    // Process standard platform links
    for (const [p, regex] of Object.entries(CONFIG.ALLOWED_DOMAINS)) {
      if (!['kakobuy', 'cnfans', 'joyabuy', 'pandabuy', 'mulebuy'].includes(p) && regex.test(url)) {
        platform = p;
        break;
      }
    }

    if (platform) {
      const cleaned = cleanUrl(url, platform);
      if (cleaned) validLinks.push({ 
        original: url, 
        cleaned: cleaned, 
        platform: platform, 
        needsAffiliate: true 
      });
      else invalidUrls.push(url);
    } else {
      invalidUrls.push(url);
    }
  }

  return { validLinks, invalidUrls };
}

// Specific Platform Processors
async function processPandabuyLink(url) {
  try {
    // Handle short links
    const isShortLink = CONFIG.SHORT_LINK_PROVIDERS.some(domain => url.includes(domain));
    if (isShortLink) {
      const response = await fetch(url, { 
        method: 'HEAD', 
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const location = response.headers.get('location');
      if (location) url = location;
    }

    // Process product links
    if (url.includes('pandabuy.com/product')) {
      const urlObj = new URL(url);
      const encodedUrl = urlObj.searchParams.get('url');
      if (!encodedUrl) return null;
      
      const decodedUrl = decodeURIComponent(encodedUrl);
      const originalPlatform = getPlatformFromUrl(decodedUrl);
      
      if (!originalPlatform) return null;
      
      return {
        original: url,
        cleaned: decodedUrl,
        platform: originalPlatform,
        needsAffiliate: true,
        source: 'pandabuy'
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Greška u procesiranju PandaBuy-a:', error);
    return null;
  }
}

function processThirdPartyLink(url, source) {
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const platformParam = urlObj.searchParams.get('platform') || 
                         urlObj.searchParams.get('shop_type');
    
    if (!id || !platformParam) return null;
    
    const platform = CONFIG.PLATFORM_MAP[platformParam.toLowerCase()] || 
                    CONFIG.PLATFORM_MAP[platformParam.toUpperCase()];
    if (!platform) return null;

    let cleanedUrl;
    switch(platform) {
      case '1688':
        cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
        break;
      case 'weidian':
        cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
        break;
      case 'taobao':
        cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
        break;
      default:
        return null;
    }

    return {
      original: url,
      cleaned: cleanedUrl,
      platform: platform,
      needsAffiliate: true,
      source: source
    };
  } catch (error) {
    console.error(`❌ Greška u obradi ${source}:`, error);
    return null;
  }
}

function processKakobuyLink(url) {
  try {
    const urlObj = new URL(url);
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const originalPlatform = getPlatformFromUrl(decodedUrl);
    
    if (!originalPlatform) return null;
    
    return {
      original: decodedUrl,
      cleaned: decodedUrl,
      platform: originalPlatform,
      needsAffiliate: !urlObj.searchParams.has('affcode'),
      kakobuyUrl: url
    };
  } catch (error) {
    console.error('❌ Kakobuy processing error:', error);
    return null;
  }
}

// Link Generation
function generateLinks(validLinks) {
  const conversions = [];
  const buttons = [];

  validLinks.forEach(({ cleaned, platform, needsAffiliate, kakobuyUrl, source }) => {
    try {
      let finalUrl = kakobuyUrl || `https://www.kakobuy.com/item/details?url=${encodeURIComponent(cleaned)}`;
      
      if (needsAffiliate) {
        finalUrl += finalUrl.includes('?') ? '&' : '?';
        finalUrl += `affcode=${CONFIG.AFF_CODE}`;
      }

      const emoji = CONFIG.EMOJI_MAPPING[platform] || '🔗';
      const sourceIndicator = source ? ` (from ${source})` : '';
      
      conversions.push(
        `${emoji} ${platform.toUpperCase()}${sourceIndicator}:\n` +
        `Original: ${cleaned}\n` +
        `KakoBuy: ${finalUrl}\n`
      );
      
      buttons.push(
        new ButtonBuilder()
          .setLabel(`${platform.toUpperCase()}`)
          .setURL(cleaned)
          .setStyle(ButtonStyle.Link)
          .setEmoji(emoji)
      );
      
      buttons.push(
        new ButtonBuilder()
          .setLabel('KakoBuy')
          .setURL(finalUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji(CONFIG.EMOJI_MAPPING.kakobuy)
      );
    } catch(error) {
      console.error('❌ Greška pri generisanju linka:', error);  
        }
  });

  return { conversions, buttons };
}

// Utility Functions
function cleanUrl(url, platform) {
  try {
    const urlObj = new URL(url);
    
    switch(platform) {
      case 'taobao':
        const id = urlObj.searchParams.get('id');
        return id ? `https://item.taobao.com/item.htm?id=${id}` : null;
      
      case 'weidian':
        const itemID = urlObj.searchParams.get('itemID');
        return itemID ? `https://weidian.com/item.html?itemID=${itemID}` : null;
      
      case '1688':
        const offerId = urlObj.pathname.split('/').pop();
        return offerId ? `https://detail.1688.com/offer/${offerId}.html` : null;
      
      default:
        return null;
    }
  } catch (error) {
    console.error('❌ Greška pri čišćenju URL-a:', error);
    return null;
  }
}

function getPlatformFromUrl(url) {
  for (const [platform, regex] of Object.entries(CONFIG.ALLOWED_DOMAINS)) {
    if (!['kakobuy', 'cnfans', 'joyabuy', 'pandabuy', 'mulebuy'].includes(platform) && regex.test(url)) {
      return platform;
    }
  }
  return null;
}

async function punishUser(message) {
  try {
    const member = message.member;
    if (!member) return;

    if (member.id === member.guild.ownerId) return;
    if (!member.moderatable) return;
    if (member.roles.highest.position >= message.guild.members.me.roles.highest.position) return;

    await member.timeout(60000, "Spamovanje linkovima");
    await message.reply({
      content: `⚠️ ${member} Molimo te, prestani da šalješ linkove! (1 minut zabrane)`,
      allowedMentions: { users: [member.id] }
    });
  } catch (error) {
    console.error('❌ Greška pri kažnjavanju:', error.message);
  }
}

function extractAllUrls(content) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return [...new Set(content.match(urlRegex) || [])];
}

function handleSpamDetection(userId, links) {
  const now = Date.now();
  let userData = userLinkCounts.get(userId) || { 
    counts: new Map(), 
    lastMessageTime: 0,
    timeout: null
  };

  // Reset if window has passed
  if (now - userData.lastMessageTime > CONFIG.SPAM_WINDOW) {
    userData = { counts: new Map(), lastMessageTime: now, timeout: null };
  }

  let isSpam = false;
  links.forEach(({ original }) => {
    const count = userData.counts.get(original) || 0;
    userData.counts.set(original, count + 1);
    if (count + 1 >= CONFIG.SPAM_LIMIT) isSpam = true;
  });

  userData.lastMessageTime = now;
  clearTimeout(userData.timeout);
  userData.timeout = setTimeout(() => userLinkCounts.delete(userId), CONFIG.SPAM_WINDOW);
  userLinkCounts.set(userId, userData);
  
  return isSpam;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err);
  process.exit(1);
});

// Na kraju vašeg fajla, nakon client.login()
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  // PM2 će automatski restartovati proces
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  // PM2 će automatski restartovati proces
  process.exit(1);
});