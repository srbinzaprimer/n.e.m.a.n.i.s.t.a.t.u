require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const { Buffer } = require('buffer');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

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
    cnfans: '<:cn:1354527507180949615>',
    joyabuy: '<:jy:1354527507180949615>',
    joyagoo: '<:jg:1354527507180949615>',
    pandabuy: '<:pb:1354527507180949615>',
    mulebuy: '<:mb:1354527507180949615>',
    superbuy: '<:sb:1354527507180949615>',
    cssbuy: '<:cb:1354527507180949615>',
    wegobuy: '<:wb:1354527507180949615>',
    sugargoo: '<:sg:1354527507180949615>',
    hagobuy: '<:hg:1354527507180949615>',
    basetao: '<:bt:1354527507180949615>',
    loongbuy: '<:lb:1354527507180949615>',
    hoobuy: '<:hb:1354527507180949615>',
    acbuy: '<:ab:1354527507180949615>',
    allchinabuy: '<:acb:1354527507180949615>',
    orientdig: '<:od:1354527507180949615>',
    oopbuy: '<:ob:1354527507180949615>',
    ootdbuy: '<:otb:1354527507180949615>',
    lovegobuy: '<:lgb:1354527507180949615>'
  },
  ALLOWED_DOMAINS: {
    taobao: /taobao\.com\/list\/item|\/item\.taobao\.com/i,
    weidian: /weidian\.com/i,
    '1688': /1688\.com/i,
    kakobuy: /kakobuy\.com/i,
    cnfans: /cnfans\.com/i,
    joyabuy: /joyabuy\.com/i,
    joyagoo: /joyagoo\.com/i,
    pandabuy: /pandabuy\.(com|page\.link|allapp\.link)/i,
    mulebuy: /mulebuy\.com/i,
    superbuy: /superbuy\.com/i,
    cssbuy: /cssbuy\.com\/item-(1688|taobao|weidian)|cssbuy\.com\/item-micro/i,
    wegobuy: /wegobuy\.com/i,
    sugargoo: /sugargoo\.com/i,
    hagobuy: /hagobuy\.com/i,
    basetao: /basetao\.com/i,
    loongbuy: /loongbuy\.com/i,
    hoobuy: /hoobuy\.com/i,
    acbuy: /acbuy\.com/i,
    allchinabuy: /allchinabuy\.com/i,
    orientdig: /orientdig\.com/i,
    oopbuy: /oopbuy\.com/i,
    ootdbuy: /ootdbuy\.com/i,
    lovegobuy: /lovegobuy\.com/i
  },
  PLATFORM_MAP: {
    'ALI_1688': '1688',
    'WEIDIAN': 'weidian',
    'TAOBAO': 'taobao',
    'ali_1688': '1688',
    'weidian': 'weidian',
    'taobao': 'taobao',
    'WD': 'weidian',
    'TB': 'taobao',
    1688: '1688'
  },
  SHORT_LINK_PROVIDERS: [
    'pandabuy.page.link',
    'pandabuy.allapp.link',
    'wegobuy.page.link',
    'superbuy.link',
    'cssbuy.link',
    'superbuy.com/en/page/buy'
  ]
};

// Definišemo mapu procesora direktno
const AGENT_PROCESSORS = {
  kakobuy: processKakobuyLink,
  cnfans: processCnfansLink,
  joyabuy: processJoyabuyLink,
  joyagoo: processJoyagooLink,
  pandabuy: processPandabuyLink,
  mulebuy: processMulebuyLink,
  superbuy: processSuperbuyLink,
  cssbuy: processCSSBuyLink,
  wegobuy: processWegobuyLink,
  sugargoo: processSugargooLink,
  hagobuy: processHagobuyLink,
  basetao: processBasetaoLink,
  loongbuy: processLoongbuyLink,
  hoobuy: processHoobuyLink,
  acbuy: processAcbuyLink,
  allchinabuy: processAllchinabuyLink,
  orientdig: processOrientdigLink,
  oopbuy: processOopbuyLink,
  ootdbuy: processOotdbuyLink,
  lovegobuy: processLovegobuyLink
};

const userLinkCounts = new Map();

client.on('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} je spreman!`);
  console.log(`🛒 Podržani agenti: ${Object.keys(AGENT_PROCESSORS).join(', ')}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CONFIG.ALLOWED_CHANNEL) return;

  try {
    const userId = message.author.id;
    const allUrls = extractAllUrls(message.content);
    const { validLinks, invalidUrls } = await processUrls(allUrls);

    if (invalidUrls.length > 0) {
      await message.reply({
        content: `🚫 Nepodržan link. Podržani agenti: ${Object.keys(AGENT_PROCESSORS).join(', ')}`,
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
          `${message.author}, uspešno smo konvertovali vaš link! Srećna kupovina!`,
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

async function processUrls(urls) {
  const validLinks = [];
  const invalidUrls = [];

  for (const url of urls) {
   // console.log('Processing URL:', url);
    
    let processed = false;

    // Provera za agente
    for (const [agent, processor] of Object.entries(AGENT_PROCESSORS)) {
      if (CONFIG.ALLOWED_DOMAINS[agent] && CONFIG.ALLOWED_DOMAINS[agent].test(url)) {
        console.log(`Matched agent ${agent} for URL ${url}`);
        try {
          const result = await processor(url);
          if (result) {
            console.log(`Successfully processed with ${agent}:`, result);
            validLinks.push(result);
            processed = true;
            break;
          }
        } catch (error) {
          console.error(`Error in ${agent} processor:`, error);
        }
      }
    }

    if (processed) continue;

    // Provera za osnovne platforme
    let platform = null;
    for (const [p, regex] of Object.entries(CONFIG.ALLOWED_DOMAINS)) {
      if (!Object.keys(AGENT_PROCESSORS).includes(p) && regex.test(url)) {
        platform = p;
        break;
      }
    }

    if (platform) {
      const cleaned = cleanUrl(url, platform);
      if (cleaned) {
        validLinks.push({ 
          original: url, 
          cleaned: cleaned, 
          platform: platform, 
          needsAffiliate: true 
        });
      } else {
        invalidUrls.push(url);
      }
    } else {
      invalidUrls.push(url);
    }
  }

  return { validLinks, invalidUrls };
}

async function processKakobuyLink(url) {
  try {
    const urlObj = new URL(url);
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: !urlObj.searchParams.has('affcode'),
      source: 'kakobuy'
    };
  } catch (error) {
   console.error('Kakobuy processing error:', error);
    return null;
  }
}

async function processCnfansLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za novi format (shop_type i id)
    const shopType = urlObj.searchParams.get('shop_type');
    const id = urlObj.searchParams.get('id');
    
    if (shopType && id) {
      const platform = CONFIG.PLATFORM_MAP[shopType.toLowerCase()];
      if (!platform) return null;
      
      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }
      
      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'cnfans'
      };
    }
    
    // Provera za stari format (url parametar)
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'cnfans'
    };
  } catch (error) {
    console.error('Cnfans processing error:', error);
    return null;
  }
}

async function processJoyabuyLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za format sa shop_type i id parametrima
    const shopType = urlObj.searchParams.get('shop_type');
    const id = urlObj.searchParams.get('id');
    
    if (shopType && id) {
      const platform = CONFIG.PLATFORM_MAP[shopType.toLowerCase()];
      if (!platform) return null;
      
      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }
      
      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'joyabuy'
      };
    }
    
    // Provera za stari format (url parametar)
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'joyabuy'
    };
  } catch (error) {
    console.error('Joyabuy processing error:', error);
    return null;
  }
}

async function processJoyagooLink(url) {
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const platformParam = urlObj.searchParams.get('shop_type');
    
    if (!id || !platformParam) return null;
    
    const platform = CONFIG.PLATFORM_MAP[platformParam.toLowerCase()];
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
      source: 'joyagoo'
    };
  } catch (error) {
    console.error('Joyagoo processing error:', error);
    return null;
  }
}

async function processPandabuyLink(url) {
  try {
    let result = await processPandabuyLinkStandard(url);
    if (result) return result;
    
    result = await processPandabuyLinkViaAPI(url);
    if (result) return result;
    
    return null;
  } catch (error) {
    console.error('PandaBuy processing error:', error);
    return null;
  }
}

async function processMulebuyLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za format sa shop_type i id parametrima
    const shopType = urlObj.searchParams.get('shop_type');
    const id = urlObj.searchParams.get('id');
    
    if (shopType && id) {
      const platform = CONFIG.PLATFORM_MAP[shopType.toLowerCase()];
      if (!platform) return null;
      
      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }
      
      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'mulebuy'
      };
    }
    
    // Provera za stari format (url parametar)
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'mulebuy'
    };
  } catch (error) {
    console.error('Mulebuy processing error:', error);
    return null;
  }
}

async function processSuperbuyLink(url) {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.pathname.includes('/item/')) {
      const id = urlObj.pathname.split('/').pop();
      if (id) {
        return {
          original: url,
          cleaned: `https://www.superbuy.com/item/${id}`,
          platform: 'superbuy',
          needsAffiliate: true
        };
      }
    }
    
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const platform = getPlatformFromUrl(decodedUrl);
      
      if (platform) {
        return {
          original: url,
          cleaned: decodedUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'superbuy'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Superbuy processing error:', error);
    return null;
  }
}

async function processCSSBuyLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za mikro format
    const microMatch = urlObj.pathname.match(/\/item-micro-(\d+)\.html/);
    if (microMatch) {
      const id = microMatch[1];
      return {
        original: url,
        cleaned: `https://weidian.com/item.html?itemID=${id}`,
        platform: 'weidian',
        needsAffiliate: true,
        source: 'cssbuy'
      };
    }
    
    // Provera za standardni format
    const pathMatch = urlObj.pathname.match(/\/item-(1688|taobao|weidian)-(\d+)\.html/);
    if (pathMatch) {
      const platform = pathMatch[1];
      const id = pathMatch[2];
      let cleanedUrl;
      
      switch(platform) {
        case '1688': cleanedUrl = `https://detail.1688.com/offer/${id}.html`; break;
        case 'weidian': cleanedUrl = `https://weidian.com/item.html?itemID=${id}`; break;
        case 'taobao': cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`; break;
        default: return null;
      }
      
      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'cssbuy'
      };
    }

    // Provera za url parametar
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const platform = getPlatformFromUrl(decodedUrl);
      if (platform) {
        return {
          original: url,
          cleaned: decodedUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'cssbuy'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('CSSBuy processing error:', error);
    return null;
  }
}

async function processWegobuyLink(url) {
  try {
    if (CONFIG.SHORT_LINK_PROVIDERS.some(domain => url.includes(domain))) {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      if ([301, 302].includes(response.status)) {
        return await processWegobuyLink(response.headers.get('location'));
      }
    }

    const urlObj = new URL(url);
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const platform = getPlatformFromUrl(decodedUrl);
      if (platform) {
        return {
          original: url,
          cleaned: decodedUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'wegobuy'
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Wegobuy processing error:', error);
    return null;
  }
}

async function processSugargooLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za format sa hash i productLink parametrom
    if (urlObj.hash) {
      // Uklanjamo # iz hash dela
      const hashPart = urlObj.hash.substring(1);
      
      // Pokušavamo da pronađemo productLink u hash delu
      const hashParams = new URLSearchParams(hashPart.split('?')[1]);
      const productLink = hashParams.get('productLink');
      
      if (productLink) {
        const decodedUrl = decodeURIComponent(productLink);
        const urlParams = new URLSearchParams(new URL(decodedUrl).search);
        const itemId = urlParams.get('itemID');
        
        if (itemId) {
          return {
            original: url,
            cleaned: `https://weidian.com/item.html?itemID=${itemId}`,
            platform: 'weidian',
            needsAffiliate: true,
            source: 'sugargoo'
          };
        }
      }
    }
    
    // Provera za stari format (url parametar)
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const urlParams = new URLSearchParams(new URL(decodedUrl).search);
      const itemId = urlParams.get('itemID');
      
      if (itemId) {
        return {
          original: url,
          cleaned: `https://weidian.com/item.html?itemID=${itemId}`,
          platform: 'weidian',
          needsAffiliate: true,
          source: 'sugargoo'
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function processHagobuyLink(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const platform = getPlatformFromUrl(decodedUrl);
      if (platform) {
        return {
          original: url,
          cleaned: decodedUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'hagobuy'
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Hagobuy processing error:', error);
    return null;
  }
}

async function processBasetaoLink(url) {
  try {
    const urlObj = new URL(url);
    
    // Provera za format /products/agent/{platform}/{id}.html
    const pathMatch = urlObj.pathname.match(/\/products\/agent\/(\w+)\/(\d+)\.html/);
    if (pathMatch) {
      const platform = CONFIG.PLATFORM_MAP[pathMatch[1].toLowerCase()];
      const id = pathMatch[2];
      
      if (!platform || !id) return null;
      
      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }
      
      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'basetao'
      };
    }
    
    // Provera za url parametar (stari format)
    if (urlObj.searchParams.has('url')) {
      const decodedUrl = decodeURIComponent(urlObj.searchParams.get('url'));
      const platform = getPlatformFromUrl(decodedUrl);
      if (platform) {
        return {
          original: url,
          cleaned: decodedUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'basetao'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Basetao processing error:', error);
    return null;
  }
}

async function processLoongbuyLink(url) {
  try {
    const urlObj = new URL(url);
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'loongbuy'
    };
  } catch (error) {
    console.error('Loongbuy processing error:', error);
    return null;
  }
}

async function processHoobuyLink(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (!id) return null;
    
    return {
      original: url,
      cleaned: `https://weidian.com/item.html?itemID=${id}`,
      platform: 'weidian',
      needsAffiliate: true,
      source: 'hoobuy'
    };
  } catch (error) {
    console.error('Hoobuy processing error:', error);
    return null;
  }
}

async function processAcbuyLink(url) {
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const source = urlObj.searchParams.get('source');
    
    if (!id || !source) return null;
    
    const platform = CONFIG.PLATFORM_MAP[source] || 'weidian';
    
    let cleanedUrl;
    switch(platform) {
      case 'weidian': 
        cleanedUrl = `https://weidian.com/item.html?itemID=${id}`; 
        break;
      case 'taobao': 
        cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`; 
        break;
      case '1688': 
        cleanedUrl = `https://detail.1688.com/offer/${id}.html`; 
        break;
      default: 
        return null;
    }
    
    return {
      original: url,
      cleaned: cleanedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'acbuy'
    };
  } catch (error) {
    console.error('AcBuy processing error:', error);
    return null;
  }
}

function cleanWeidianUrl(url) {
  try {
    const urlObj = new URL(url);
    const itemId = urlObj.searchParams.get('itemId');
    if (!itemId) return url;
    
    // Ako ima više itemId parametara, uzimamo prvi
    const cleanItemId = itemId.split('?')[0];
    return `https://weidian.com/item.html?itemID=${cleanItemId}`;
  } catch (error) {
    console.error('Weidian URL cleaning error:', error);
    return url;
  }
}

async function processAllchinabuyLink(url) {
  try {
    const urlObj = new URL(url);
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    const decodedUrl = decodeURIComponent(encodedUrl);
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) return null;
    
    // Čistimo URL ako je Weidian
    const cleanedUrl = platform === 'weidian' ? cleanWeidianUrl(decodedUrl) : decodedUrl;
    
    return {
      original: url,
      cleaned: cleanedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'allchinabuy'
    };
  } catch (error) {
    console.error('Allchinabuy processing error:', error);
    return null;
  }
}

async function processOrientdigLink(url) {
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const platformParam = urlObj.searchParams.get('platform') || urlObj.searchParams.get('shop_type');
    
    if (!id || !platformParam) return null;
    
    const platform = CONFIG.PLATFORM_MAP[platformParam.toLowerCase()];
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
      source: 'orientdig'
    };
  } catch (error) {
    console.error('Orientdig processing error:', error);
    return null;
  }
}

async function processOopbuyLink(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.trim() !== '');
    if (pathParts.length >= 2 && pathParts[0] === 'product') {
      const platform = CONFIG.PLATFORM_MAP[pathParts[1].toLowerCase()];
      const id = pathParts[2];
      
      if (!id || !platform) return null;

      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }

      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'oopbuy'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Oopbuy processing error:', error);
    return null;
  }
}

async function processOotdbuyLink(url) {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.pathname.includes('/goods/details')) {
      const id = urlObj.searchParams.get('id');
      const channel = urlObj.searchParams.get('channel') || 'weidian';
      const platform = CONFIG.PLATFORM_MAP[channel.toLowerCase()];
      
      if (!id || !platform) return null;

      let cleanedUrl;
      switch(platform) {
        case 'weidian':
          cleanedUrl = `https://weidian.com/item.html?itemID=${id}`;
          break;
        case 'taobao':
          cleanedUrl = `https://item.taobao.com/item.htm?id=${id}`;
          break;
        case '1688':
          cleanedUrl = `https://detail.1688.com/offer/${id}.html`;
          break;
        default:
          return null;
      }

      return {
        original: url,
        cleaned: cleanedUrl,
        platform: platform,
        needsAffiliate: true,
        source: 'ootdbuy'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Ootdbuy processing error:', error);
    return null;
  }
}

async function processLovegobuyLink(url) {
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const platformParam = urlObj.searchParams.get('platform') || urlObj.searchParams.get('shop_type');
    
    if (!id || !platformParam) return null;
    
    const platform = CONFIG.PLATFORM_MAP[platformParam.toLowerCase()];
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
      source: 'lovegobuy'
    };
  } catch (error) {
    console.error('Lovegobuy processing error:', error);
    return null;
  }
}

function cleanUrl(url, platform) {
  try {
    const urlObj = new URL(url);
    
    switch(platform) {
      case 'taobao':
        const id = urlObj.searchParams.get('id');
        if (id) return `https://item.taobao.com/item.htm?id=${id}`;
        
        if (urlObj.pathname.includes('/list/item/')) {
          const itemId = urlObj.pathname.split('/').pop().replace('.htm', '');
          return `https://item.taobao.com/item.htm?id=${itemId}`;
        }
        return null;
      
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
    console.error('URL cleaning error:', error);
    return null;
  }
}

function getPlatformFromUrl(url) {
  try {
    for (const [platform, regex] of Object.entries(CONFIG.ALLOWED_DOMAINS)) {
      if (!Object.keys(AGENT_PROCESSORS).includes(platform) && regex.test(url)) {
        return platform;
      }
    }
    
    if (url.includes('taobao')) return 'taobao';
    if (url.includes('weidian')) return 'weidian';
    if (url.includes('1688')) return '1688';
    
    return null;
  } catch (error) {
    console.error('Platform detection error:', error);
    return null;
  }
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
      content: `⚠️ ${member} Prekoračili ste limit za slanje linkova! (1 minut zabrane)`,
      allowedMentions: { users: [member.id] }
    });
  } catch (error) {
    console.error('Kažnjavanje greška:', error.message);
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

function generateLinks(validLinks) {
  const conversions = [];
  const buttons = [];

  validLinks.forEach(({ cleaned, platform, needsAffiliate, source }) => {
    try {
      const finalUrl = `https://www.kakobuy.com/item/details?url=${encodeURIComponent(cleaned)}${needsAffiliate ? `&affcode=${CONFIG.AFF_CODE}` : ''}`;
      const emoji = CONFIG.EMOJI_MAPPING[platform] || '🔗';
      const sourceIndicator = source ? ` (${source})` : '';
      
      conversions.push(
        `${emoji} ${platform.toUpperCase()}${sourceIndicator}: ${finalUrl}`
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
      console.error('Link generation error:', error);  
    }
  });

  return { conversions, buttons };
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processPandabuyLinkStandard(url) {
  try {
    const urlObj = new URL(url);
    const encodedUrl = urlObj.searchParams.get('url');
    if (!encodedUrl) return null;
    
    console.log('Encoded URL:', encodedUrl);
    
    // Prvo dekodiramo URL-encoded string
    let decodedUrl = decodeURIComponent(encodedUrl);
    console.log('After URL decode:', decodedUrl);
    
    // Ako nije validan URL, pokušavamo base64 dekodiranje
    if (!decodedUrl.match(/^https?:\/\//)) {
      try {
        // Čistimo string od specijalnih karaktera
        const cleaned = decodedUrl
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .replace(/%2B/g, '+')
          .replace(/%2F/g, '/')
          .replace(/%3D/g, '=')
          .replace(/\s/g, '');
        
        console.log('Cleaned string:', cleaned);
        
        // Dodajemo padding ako je potrebno
        const padding = cleaned.length % 4;
        const padded = padding ? cleaned + '='.repeat(4 - padding) : cleaned;
        
        console.log('Padded string:', padded);
        
        // Pokušavamo base64 dekodiranje
        decodedUrl = Buffer.from(padded, 'base64').toString('utf-8');
        console.log('After base64 decode:', decodedUrl);
        
        // Ako i dalje nije validan URL, pokušavamo sa raw stringom
        if (!decodedUrl.match(/^https?:\/\//)) {
          // Pokušavamo da dekodiramo raw string
          try {
            decodedUrl = decodeURIComponent(cleaned);
            console.log('After raw string decode:', decodedUrl);
          } catch (e) {
            console.log('Raw string decode failed:', e);
            decodedUrl = cleaned;
          }
        }
      } catch (base64Error) {
        console.log('Base64 decode error:', base64Error);
        // Pokušavamo da dekodiramo originalni string
        try {
          decodedUrl = decodeURIComponent(encodedUrl);
        } catch (e) {
          decodedUrl = encodedUrl;
        }
      }
    }
    
    // Proveravamo da li je finalni URL validan
    if (!decodedUrl.match(/^https?:\/\//)) {
      console.log('Final URL not valid:', decodedUrl);
      return null;
    }
    
    const platform = getPlatformFromUrl(decodedUrl);
    if (!platform) {
      console.log('Could not determine platform from:', decodedUrl);
      return null;
    }
    
    return {
      original: url,
      cleaned: decodedUrl,
      platform: platform,
      needsAffiliate: true,
      source: 'pandabuy'
    };
  } catch (error) {
    console.error('PandaBuy standard processing error:', error);
    return null;
  }
}

async function processPandabuyLinkViaAPI(url) {
  try {
    // Prvo pokušavamo sa direktnim API pozivom
    const apiUrl = `https://www.pandabuy.com/api/product/info?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.pandabuy.com/',
        'Accept': 'application/json',
        'Origin': 'https://www.pandabuy.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      }
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Pokušavamo alternativni endpoint
      const altApiUrl = `https://www.pandabuy.com/api/product/detail?url=${encodeURIComponent(url)}`;
      
      const altResponse = await fetch(altApiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.pandabuy.com/',
          'Accept': 'application/json',
          'Origin': 'https://www.pandabuy.com',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty'
        }
      });
      
      if (altResponse.ok) {
        const data = await altResponse.json();
        
        if (data.code === 200 && data.data && data.data.origin_url) {
          const originUrl = data.data.origin_url;
          const platform = getPlatformFromUrl(originUrl);
          
          if (platform) {
            return {
              original: url,
              cleaned: originUrl,
              platform: platform,
              needsAffiliate: true,
              source: 'pandabuy'
            };
          }
        }
      }
      
      return null;
    }

    const data = await response.json();
    
    if (data.code === 200 && data.data && data.data.origin_url) {
      const originUrl = data.data.origin_url;
      const platform = getPlatformFromUrl(originUrl);
      
      if (platform) {
        return {
          original: url,
          cleaned: originUrl,
          platform: platform,
          needsAffiliate: true,
          source: 'pandabuy'
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});