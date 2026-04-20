import plugin from '../../../lib/plugins/plugin.js'
import commonTools from '../model/commonTools.js'
import moracfg from '../model/config.js'
import _ from 'lodash'
import fs from 'node:fs'
import fetch from 'node-fetch'
import path from 'path'

/**
 * 借鉴原云崽攻略代码
 * 攻略来自NGA@妮可少女
 */
/**
 * 深渊/混沌/虚构/末日/幽境危战/剧诗/异相仲裁版本图片发送，支持别名
 * 数据来自 b站@妮可少女 b站@此号已封12138 (https://space.bilibili.com/40358750) @南卡
 * 玖、grok、GitHub copilot、TRAE（kimi）
 */
// 仓库配置（按优先级）
const REPO_URLS = [
  'https://cnb.cool/JIUXJIU/Abyss/-/git/raw/main',
  'https://cnb.cool/JIUXJIU/AbyssBeta/-/git/raw/main'
]

export class abyssVersion extends plugin {
  constructor() {
    // 构建别名和正则列表只维护一份，自动生成
    const aliasDict = abyssVersion.getAliasesStatic();
    const aliasList = Array.from(new Set(
      Object.values(aliasDict).flatMap(obj => Object.entries(obj).flatMap(([key, arr]) => [key, ...arr]))
    ));
    const typeReg = aliasList.map(_.escapeRegExp).join("|");
    super({
      name: '摩拉深渊版本',
      dsc: '各版本深渊怪物',
      event: 'message',
      priority: 5,
      rule: [
        {
          reg: `^#?(原神|星铁)?([1-9]\\.\\d{1})(${typeReg})$`,
          fnc: 'abyssVersion'
        },
        {
          reg: '^#?历代12(层|-[1-3])?(最低输出量)?$',
          fnc: 'history12'
        },
        {
          reg: '^#?[1-9]\.\\d(深渊)?阵容(参考|推荐)?$',
          fnc: 'teamRefer'
        }
      ]
    })

    // Abyss 目录
    this.abyssDir = path.join(process.cwd(), 'data', 'Abyss')
    if (!fs.existsSync(this.abyssDir)) {
      fs.mkdirSync(this.abyssDir, { recursive: true })
    }
    const cron = '0 0 1/10 * *' // 5 字段：每 10 天的 00:00 执行一次（minute hour day month weekday）
    this.task = {
      name: '[摩拉深渊版本]data/Abyss 自动清理',
      cron: cron,
      fnc: () => {
        this.cleanAbyssDir();
      }
    }
  }

  // 静态别名数据
  static getAliasesStatic() {
    return {
      ys: {
        "深境螺旋": ["深渊", "深境", "螺旋"],
        "幽境危战": ["幽境", "危战"],
        "幻想真境剧诗": ["幻想", "真境", "剧诗"]
      },
      sr: {
        "混沌回忆": ["混沌", "回忆", "深渊"],
        "虚构叙事": ["虚构", "叙事", "构事"],
        "末日幻影": ["末日", "幻影", "末影"],
        "异相仲裁": ["异相", "仲裁", "王棋"]
      }
    }
  }

  getAliases() {
    return abyssVersion.getAliasesStatic();
  }

  // 获取标准名称（支持别名）
  getFormalName(role, game) {
    const aliases = this.getAliases()[game] || {}
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(role) || key === role) {
        return key
      }
    }
    return role
  }

  // 判断是否为某挑战类型
  matchType(type, game, target) {
    const formalName = this.getFormalName(type, game)
    return formalName === target
  }

  // 计算编号
  // 始终返回字符串数组
  calculateNumber(version, formalAbyss, game) {
    // 异相仲裁、幽境危战：直接使用数字
    if (formalAbyss === '异相仲裁' || formalAbyss === '幽境危战') {
      return [version]
    }

    // 星铁：混沌回忆、虚构叙事、末日幻影
    if (game === 'sr' && ['混沌回忆', '虚构叙事', '末日幻影'].includes(formalAbyss)) {
      const versionMap = abyssVersion.getVersionMap()

      // 优先检查固定映射表
      if (versionMap[formalAbyss] && versionMap[formalAbyss][version]) {
        const mappedValue = versionMap[formalAbyss][version]
        // 支持数组或字符串
        return Array.isArray(mappedValue) ? mappedValue : [mappedValue]
      }

      // 没有则自动推算（以4.0为基准）
      const baseValues = {
        '混沌回忆': 1030,
        '虚构叙事': 2021,
        '末日幻影': 3015
      }
      const baseValue = baseValues[formalAbyss]
      if (baseValue && version.match(/^(\d+)\.(\d)$/)) {
        let [vMain, vSub] = version.split('.').map(Number)
        let offset = (vMain - 4) * 10 + vSub
        return [String(baseValue + offset)]
      }
    }

    // 原神：深境螺旋、幻想真境剧诗 - 格式为 数字/数字+A/B
    if (game === 'ys') {
      if (formalAbyss === '深境螺旋' || formalAbyss === '幻想真境剧诗') {
        return [version, `${version}A`, `${version}B`]
      }
    }

    return [version]
  }

  // 从仓库下载图片
  async downloadFromRepo(repoUrl, standardName, number) {
    const url = `${repoUrl}/${standardName}/${number}.png`
    const local = path.join(this.abyssDir, `${standardName}_${number}.png`)

    try {
      logger.mark(`[深渊版本] 尝试下载: ${url}`)
      const res = await fetch(url)
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        fs.writeFileSync(local, Buffer.from(arrayBuffer))
        logger.mark(`[深渊版本] 下载成功: ${standardName}/${number}.png`)
        return local
      }
    } catch (e) {
      logger.error(`[深渊版本] 下载失败: ${url}`, e.message)
    }
    return null
  }

  // 获取图片（优先本地，没有则从仓库下载）
  async getImage(standardName, number) {
    const localFile = path.join(this.abyssDir, `${standardName}_${number}.png`)

    // 优先本地
    if (fs.existsSync(localFile)) {
      logger.mark(`[深渊版本] 使用本地图片: ${standardName}/${number}.png`)
      return localFile
    }

    // 从仓库下载（按优先级尝试）
    for (const repoUrl of REPO_URLS) {
      const downloaded = await this.downloadFromRepo(repoUrl, standardName, number)
      if (downloaded) return downloaded
    }

    logger.warn(`[深渊版本] 所有仓库均无图片: ${standardName}/${number}.png`)
    return null
  }

  async abyssVersion() {
    await this.e.reply('查询中，请稍后', true, { recallMsg: 20 })

    const aliasList = Array.from(new Set(
      Object.values(this.getAliases()).flatMap(obj => Object.entries(obj).flatMap(([key, arr]) => [key, ...arr]))
    ));
    const typeReg = aliasList.map(_.escapeRegExp).join("|");

    let match = new RegExp(`^#?(原神|星铁)?([1-9]\\.\\d{1})(${typeReg})$`).exec(this.e.msg)
    if (!match) return false

    let [, gameType, version, abyss] = match
    let game = gameType === '星铁' ? 'sr' : 'ys'

    // 获取标准名称
    let formalAbyss = this.getFormalName(abyss, game)

    // 根据挑战类型自动判断游戏
    if (['混沌回忆', '虚构叙事', '末日幻影', '异相仲裁'].includes(formalAbyss)) {
      game = 'sr'
    } else if (['深境螺旋', '幻想真境剧诗', '幽境危战'].includes(formalAbyss)) {
      game = 'ys'
    }

    // 计算编号（始终返回数组）
    const numberList = this.calculateNumber(version, formalAbyss, game)

    // 获取所有图片
    let imageSegments = []
    for (const num of numberList) {
      const imgPath = await this.getImage(formalAbyss, num)
      if (imgPath) {
        imageSegments.push(segment.image(imgPath))
      }
    }

    if (imageSegments.length > 0) {
      logger.mark(`[深渊版本] 成功获取 ${imageSegments.length} 张图片`)
      let msg = [`${game === 'sr' ? '星铁' : '原神'} ${version} ${formalAbyss}`]
      imageSegments.forEach(seg => msg.push(seg))
      await this.e.reply(msg)
      return true
    } else {
      logger.warn(`[深渊版本] 未能获取任何图片`)
      await this.e.reply(`暂无${game === 'sr' ? '星铁' : '原神'} ${version} 版本 ${formalAbyss} 图片`)
      return false
    }
  }

  /** 12层历史 */
  async history12() {
    this.path = `${this.dirPath(this.e.game)}/Version/history12`
    await this.checkRes(this.path)

    let room = /^#?历代12(层|-[1-3])?(最低输出量)?$/.exec(this.e.msg)[1]
    if (!room) return false

    let msg = []

    if (room === '层') {
      let pics = fs.readdirSync(this.path)
      _.each(pics, (v) => msg.push(segment.image(`file://${this.path}/${v}`)))
      await this.e.reply(await commonTools.makeMsg(this.e, msg, '历代深渊12层最低输出量'))
    } else {
      let img = `${this.path}/历代12${room}最低输出量.png`
      if (fs.existsSync(img)) await this.e.reply(segment.image(`file://${img}`))
    }
    return true
  }

  async teamRefer() {
    this.path = `${this.dirPath(this.e.game)}/Teams/`
    await this.checkRes(this.path)

    let ver = /^#?([1-9]\.\d)深渊?阵容(参考|推荐)?$/.exec(this.e.msg)[1]
    if (!ver) return false

    let img = `${this.path}卡玛sei亚/${ver}.png`
    if (!fs.existsSync(img)) {
      await this.e.reply(`暂无${ver}深渊阵容`)
      return false
    }
    await this.e.reply(segment.image(`file://${img}`))
    return true
  }
  async checkRes(path) {
    if (!fs.existsSync(path)) {
      await this.e.reply(moracfg.resNotFound, true)
      return false
    }
  }
  async cleanAbyssDir() {
    try {
      if (fs.existsSync(this.abyssDir)) {
        fs.rmSync(this.abyssDir, { recursive: true, force: true })
      }
      fs.mkdirSync(this.abyssDir, { recursive: true })
      console.log('[Abyss] 已清理并重建 data/Abyss 目录')
    } catch (err) {
      console.error('[Abyss] 清理 data/Abyss 目录出错：', err)
    }
  }
  // 固定的版本号映射表（可扩展）
  // 支持一个版本对应单个编号或多个编号（数组）
  static getVersionMap() {
    return {
      '混沌回忆': { '1.3': ['1001', '1002', '1003'], '1.4': ['1004', '1005', '1006'], '1.5': ['1007', '1008'], '1.6': ['1009', '1010'], '2.0': ['1011', '1012'], '2.1': ['1013', '1014'], '2.7': ['1020'], '3.0': ['1021'], '3.8': ['1029'], '4.0': ['1030'] },
      '虚构叙事': { '1.6': ['2003'], '2.0': ['2004'], '2.7': ['2011'], '3.0': ['2012'], '3.8': ['2020'], '4.0': ['2021'] },
      '末日幻影': { '2.7': ['3005'], '3.0': ['3006'], '3.8': ['3014'], '4.0': ['3015'] }
    }
  }
}
